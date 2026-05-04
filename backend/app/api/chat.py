from __future__ import annotations

import asyncio
import json

import structlog
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Query

from app.models.schemas import WSMessageIn, WSMessageOut, MessagesResponse
from app.services.chat_manager import (
    load_session,
    load_messages,
    get_branch_messages,
    create_branch_from,
    delete_messages_from,
    get_chat_lock,
)
from app.services.event_bus import event_bus
from app.storage.user_protagonist_storage import load_user_protagonist
from app.storage.game_setting_storage import load_game_setting
from app.services.auth_service import decode_access_token
from app.storage.base import set_user_id
from app.storage.user_storage import get_user_by_id
from app.services import room_manager
from app.agents.tools import (
    set_push_fn,
    save_user_message,
    save_assistant_message,
    load_context,
    build_prompt,
    stream_response,
    check_should_summarize,
    summarize_conversation,
    extract_rpg_state,
)

log = structlog.get_logger()

router = APIRouter(tags=["chat"])
ws_router = APIRouter()

# Track active WebSocket connections per session for push notifications
_ws_connections: dict[str, list[WebSocket]] = {}


def _register_ws(session_id: str, ws: WebSocket) -> None:
    _ws_connections.setdefault(session_id, []).append(ws)


def _unregister_ws(session_id: str, ws: WebSocket) -> None:
    conns = _ws_connections.get(session_id, [])
    if ws in conns:
        conns.remove(ws)


async def _push_to_session(session_id: str, msg: WSMessageOut) -> None:
    """Push a message to all WebSocket connections for a session."""
    for ws in _ws_connections.get(session_id, []):
        try:
            await ws.send_text(msg.model_dump_json())
        except Exception:
            pass


# Register event bus listeners for background task notifications
async def _on_summary_complete(session_id: str, **kwargs):
    await _push_to_session(session_id, WSMessageOut(type="summary_progress", status="complete"))


async def _on_state_updated(session_id: str, data: dict | None = None, **kwargs):
    await _push_to_session(session_id, WSMessageOut(type="state_updated", data=data))


event_bus.on("summary_complete", _on_summary_complete)
event_bus.on("state_updated", _on_state_updated)


@ws_router.websocket("/ws/chat/{session_id}")
async def websocket_chat(ws: WebSocket, session_id: str, token: str = Query(default="")):
    # Authenticate via query param token
    payload = decode_access_token(token) if token else None
    if payload is None:
        await ws.close(code=4001, reason="Unauthorized")
        return
    user_id = payload.get("sub", "")
    user = await get_user_by_id(user_id)
    if user is None:
        await ws.close(code=4001, reason="Unauthorized")
        return

    # Room check: if session belongs to a room, use host's data dir
    room = await room_manager.get_or_load_room(session_id)
    if room is not None:
        set_user_id(room.host_user_id)
    else:
        set_user_id(user["id"])

    session = await load_session(session_id)
    if session is None:
        await ws.close(code=4004, reason="Session not found")
        return

    await ws.accept()
    _register_ws(session_id, ws)
    log.info("ws_connected", session_id=session_id)

    # Notify room members this player connected
    if room is not None:
        updated_room = await room_manager.set_player_online(session_id, user["id"], True)
        await _push_to_session(session_id, WSMessageOut(
            type="room_state",
            data=updated_room.model_dump() if updated_room else None,
        ))

    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg_in = WSMessageIn(**json.loads(raw))
            except Exception:
                await ws.send_text(WSMessageOut(type="error", content="Invalid message format").model_dump_json())
                continue

            if msg_in.type == "ping":
                await ws.send_text(WSMessageOut(type="pong").model_dump_json())
                continue

            # --- Room-specific message types ---
            if msg_in.type in ("submit_turn", "retract_turn", "force_submit"):
                current_room = room_manager.get_room_by_session(session_id)
                if current_room is None:
                    await ws.send_text(WSMessageOut(type="error", content="当前会话不在多人房间中").model_dump_json())
                    continue

                if msg_in.type == "retract_turn":
                    updated = await room_manager.retract_turn(session_id, user["id"])
                    await _push_to_session(session_id, WSMessageOut(
                        type="room_state",
                        data=updated.model_dump(),
                    ))
                    continue

                if msg_in.type == "submit_turn":
                    updated, all_submitted = await room_manager.submit_turn(
                        session_id, user["id"], msg_in.content
                    )
                    await _push_to_session(session_id, WSMessageOut(
                        type="room_state",
                        data=updated.model_dump(),
                    ))
                    if not all_submitted:
                        continue
                    # All online players submitted — auto process
                    msg_in = WSMessageIn(type="room_ready", content="")

                if msg_in.type in ("force_submit", "room_ready"):
                    # Host triggers processing
                    if msg_in.type == "force_submit" and current_room.host_user_id != user["id"]:
                        await ws.send_text(WSMessageOut(type="error", content="只有房主才能强制提交").model_dump_json())
                        continue
                    combined = room_manager.build_combined_content(current_room)
                    if not combined.strip():
                        await ws.send_text(WSMessageOut(type="error", content="没有玩家提交行动").model_dump_json())
                        continue

                    chat_lock = await get_chat_lock(session_id)
                    if chat_lock.locked():
                        await ws.send_text(WSMessageOut(type="error", content="另一条消息正在处理中，请稍候").model_dump_json())
                        continue

                    await room_manager.start_processing(session_id)
                    await _push_to_session(session_id, WSMessageOut(type="round_processing"))

                    async with chat_lock:
                        combined_msg = WSMessageIn(
                            type="chat",
                            content=combined,
                            connection_id=msg_in.connection_id,
                            state_connection_id=msg_in.state_connection_id,
                            context_max_tokens=msg_in.context_max_tokens,
                        )
                        await _handle_chat(ws, session_id, combined_msg, broadcast_to=session_id)

                    new_room = await room_manager.end_round(session_id)
                    await _push_to_session(session_id, WSMessageOut(
                        type="round_started",
                        data=new_room.model_dump(),
                    ))
                    continue

            if msg_in.type not in ("chat", "chat_from_branch"):
                await ws.send_text(WSMessageOut(type="error", content=f"Unknown type: {msg_in.type}").model_dump_json())
                continue

            # Normal solo chat
            if room is not None:
                await ws.send_text(WSMessageOut(type="error", content="多人模式下请使用 submit_turn").model_dump_json())
                continue

            # Acquire per-session chat lock (prevent concurrent chats)
            chat_lock = await get_chat_lock(session_id)
            if chat_lock.locked():
                await ws.send_text(WSMessageOut(type="error", content="另一条消息正在处理中，请稍候").model_dump_json())
                continue

            async with chat_lock:
                await _handle_chat(ws, session_id, msg_in)

    except WebSocketDisconnect:
        log.info("ws_disconnected", session_id=session_id)
    except Exception:
        log.exception("ws_error", session_id=session_id)
    finally:
        _unregister_ws(session_id, ws)
        # Mark player offline in room
        if room is not None:
            updated_room = await room_manager.set_player_online(session_id, user["id"], False)
            if updated_room is not None:
                await _push_to_session(session_id, WSMessageOut(
                    type="room_state",
                    data=updated_room.model_dump(),
                ))


async def _handle_chat(ws: WebSocket, session_id: str, msg_in: WSMessageIn, broadcast_to: str | None = None) -> None:
    """Handle a chat message using agent tools.

    Phase 1 (streaming): save user msg → load context → build prompt → stream → save assistant msg
    Phase 2 (background): summarize → hooks → extract state → narrator → hooks

    If broadcast_to is set, stream tokens to all WS clients of that session.
    """
    async def _send(msg: WSMessageOut) -> None:
        if broadcast_to:
            await _push_to_session(broadcast_to, msg)
        else:
            await ws.send_text(msg.model_dump_json())

    # Inject the push function into tools' context for this request
    set_push_fn(_send)

    try:
        # Handle branching
        parent_id = None
        if msg_in.type == "chat_from_branch" and msg_in.branch_from_message_id:
            await create_branch_from(session_id, msg_in.branch_from_message_id)
            parent_id = msg_in.branch_from_message_id

        # Phase 1, Step 1: Save user message
        user_msg_dict = await save_user_message(session_id, msg_in.content, parent_id)

        # Phase 1, Step 2: Load context
        ctx = await load_context(session_id)
        session_data = ctx["session"]

        # Load room/protagonist data for prompt injection
        user_protagonist = None
        room_players = None
        current_room = room_manager.get_room_by_session(session_id)
        if current_room is not None:
            room_players = [p.model_dump() for p in current_room.players]
        elif session_data and session_data.get("user_protagonist_id"):
            user_protagonist = await load_user_protagonist(session_data["user_protagonist_id"])

        # Load narrator directives (generated by previous turn's background evaluation)
        from app.services.narrator_service import consume_directives
        narrator_directives = await consume_directives(session_id)

        # Phase 1, Step 3: Build prompt with token budgeting
        characters = session_data.get("characters", []) if session_data else []
        active_settings = []
        active_setting_ids = session_data.get("active_setting_ids", []) if session_data else []
        for setting_id in active_setting_ids:
            setting_data = await load_game_setting(setting_id)
            if setting_data:
                active_settings.append(setting_data)
        recent_msgs = ctx["branch_messages"][:-1] if len(ctx["branch_messages"]) > 0 else []
        prompt_result = await build_prompt(
            system_prompt=session_data.get("system_prompt", "") if session_data else "",
            state=ctx["state"],
            summary=ctx["summary"],
            recent_messages=recent_msgs,
            user_input=msg_in.content,
            characters=characters,
            active_settings=active_settings,
            user_protagonist=user_protagonist.model_dump() if user_protagonist and hasattr(user_protagonist, 'model_dump') else user_protagonist,
            narrator_directives=narrator_directives,
            room_players=room_players,
            context_max_tokens_override=msg_in.context_max_tokens,
        )

        # Send token budget info
        await _send(WSMessageOut(
            type="token_budget",
            data=prompt_result["budget_info"],
        ))

        # Phase 1, Step 4: Stream LLM response (tokens pushed via push_fn context)
        result = await stream_response(
            messages=prompt_result["messages"],
            connection_id=msg_in.connection_id,
        )
        assistant_content = result["content"]
        assistant_thinking = result.get("thinking", "")

        # Phase 1, Step 5: Save assistant message
        assistant_msg_dict = await save_assistant_message(
            session_id, assistant_content, thinking=assistant_thinking
        )

        # Send completion
        await _send(WSMessageOut(
            type="chat_complete",
            message_id=assistant_msg_dict["id"],
        ))

        # Trigger Phase 2 background task
        asyncio.create_task(_background_post_chat(
            session_id,
            connection_id=msg_in.connection_id,
            state_connection_id=msg_in.state_connection_id,
            last_message_id=assistant_msg_dict["id"],
        ))

    except Exception as e:
        log.exception("chat_error", session_id=session_id)
        await _send(WSMessageOut(type="error", content=str(e)))


async def _background_post_chat(
    session_id: str,
    connection_id: str | None = None,
    state_connection_id: str | None = None,
    last_message_id: str | None = None,
) -> None:
    """Background task: summarize, hooks, extract state, narrator evaluation."""
    from app.agents.hook_agent import run_hooks_for_event as agent_run_hooks
    from app.agents.narrator_agent import run_narrator_evaluation

    async def _push(msg: WSMessageOut) -> None:
        await _push_to_session(session_id, msg)

    # Set up push function context for tools called here
    set_push_fn(_push)

    try:
        branch_msgs = await get_branch_messages(session_id)
        branch_msg_dicts = [m.model_dump() for m in branch_msgs]

        # Summarize if needed
        if await check_should_summarize(session_id, branch_msg_dicts):
            await summarize_conversation(session_id, branch_msg_dicts, connection_id=connection_id)
            await event_bus.emit("summary_complete", session_id=session_id)

        # Run chat_complete hooks
        await agent_run_hooks(
            session_id=session_id,
            trigger="chat_complete",
            branch_msgs=branch_msgs,
            state=None,
            connection_id=connection_id,
            push_fn=_push,
        )

        # Extract state
        effective_state_conn = state_connection_id or connection_id
        state_dict = await extract_rpg_state(session_id, branch_msg_dicts, connection_id=effective_state_conn)

        # Run state_updated hooks
        from app.models.schemas import StateData
        state = StateData(**state_dict) if state_dict else None
        await agent_run_hooks(
            session_id=session_id,
            trigger="state_updated",
            branch_msgs=branch_msgs,
            state=state,
            connection_id=connection_id,
            push_fn=_push,
        )

        # Run narrator evaluation — analyzes the full exchange (user + AI)
        # to update node statuses and generate directives for the next turn.
        narrator_result = await run_narrator_evaluation(
            session_id=session_id,
            branch_msgs=branch_msgs,
            state=state,
            connection_id=effective_state_conn,
        )
        if narrator_result:
            await _push(WSMessageOut(type="narrator_update", data=narrator_result))

    except Exception:
        log.exception("background_post_chat_failed", session_id=session_id)


# REST endpoints for message history

@router.get("/chat/{session_id}/messages", response_model=MessagesResponse)
async def get_messages(session_id: str, branch: str | None = Query(None)):
    # Room: non-host members must read from host's data dir
    room = await room_manager.get_or_load_room(session_id)
    if room is not None:
        set_user_id(room.host_user_id)
    session = await load_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    if branch:
        msgs = await get_branch_messages(session_id, branch)
    else:
        msgs = await get_branch_messages(session_id)

    return MessagesResponse(
        messages=msgs,
        active_branch=session.active_branch,
    )


@router.delete("/chat/{session_id}/messages")
async def delete_messages(session_id: str, from_message_id: str = Query(...)):
    # Room: non-host members must read from host's data dir
    room = await room_manager.get_or_load_room(session_id)
    if room is not None:
        set_user_id(room.host_user_id)
    session = await load_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    try:
        await delete_messages_from(session_id, from_message_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"ok": True}
