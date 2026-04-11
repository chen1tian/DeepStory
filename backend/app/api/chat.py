from __future__ import annotations

import asyncio
import json

import structlog
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Query

from app.models.schemas import WSMessageIn, WSMessageOut, MessagesResponse
from app.services.chat_manager import (
    load_session,
    load_messages,
    load_summary,
    load_state,
    get_branch_messages,
    add_message_to_branch,
    create_branch_from,
    delete_messages_from,
    get_chat_lock,
)
from app.services.prompt_builder import build_chat_messages
from app.services.llm_service import chat_completion_stream
from app.services.summarizer import should_summarize, incremental_summarize, extract_state
from app.services.event_bus import event_bus
from app.storage.user_protagonist_storage import load_user_protagonist

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
async def websocket_chat(ws: WebSocket, session_id: str):
    session = await load_session(session_id)
    if session is None:
        await ws.close(code=4004, reason="Session not found")
        return

    await ws.accept()
    _register_ws(session_id, ws)
    log.info("ws_connected", session_id=session_id)

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

            if msg_in.type not in ("chat", "chat_from_branch"):
                await ws.send_text(WSMessageOut(type="error", content=f"Unknown type: {msg_in.type}").model_dump_json())
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


async def _handle_chat(ws: WebSocket, session_id: str, msg_in: WSMessageIn) -> None:
    """Handle a chat message: build context, stream LLM, save, trigger background tasks."""
    try:
        # If branching, update active branch first
        parent_id = None
        if msg_in.type == "chat_from_branch" and msg_in.branch_from_message_id:
            await create_branch_from(session_id, msg_in.branch_from_message_id)
            parent_id = msg_in.branch_from_message_id

        # Save user message
        user_msg = await add_message_to_branch(session_id, "user", msg_in.content, parent_id)

        # Load context data
        session = await load_session(session_id)
        branch_msgs = await get_branch_messages(session_id)
        summary = await load_summary(session_id)
        state = await load_state(session_id)

        # Load user protagonist data for prompt injection
        user_protagonist = None
        if session and session.user_protagonist_id:
            user_protagonist = await load_user_protagonist(session.user_protagonist_id)

        # Build prompt with token budget
        messages, budget_info = await build_chat_messages(
            system_prompt=session.system_prompt if session else "",
            state=state,
            summary=summary,
            recent_messages=branch_msgs[:-1],  # exclude the user msg we just added
            user_input=msg_in.content,
            characters=[c.model_dump() for c in session.characters] if session and session.characters else [],
            user_protagonist=user_protagonist,
        )

        # Send token budget info
        await ws.send_text(WSMessageOut(
            type="token_budget",
            data=budget_info,
        ).model_dump_json())

        # Stream LLM response
        full_response = ""
        async for token in chat_completion_stream(messages, connection_id=msg_in.connection_id):
            full_response += token
            await ws.send_text(WSMessageOut(type="token", content=token).model_dump_json())

        # Save assistant message
        assistant_msg = await add_message_to_branch(session_id, "assistant", full_response)

        # Send completion
        await ws.send_text(WSMessageOut(
            type="chat_complete",
            message_id=assistant_msg.id,
        ).model_dump_json())

        # Trigger background summarization
        asyncio.create_task(_background_post_chat(session_id, connection_id=msg_in.connection_id, state_connection_id=msg_in.state_connection_id))

    except Exception as e:
        log.exception("chat_error", session_id=session_id)
        await ws.send_text(WSMessageOut(type="error", content=str(e)).model_dump_json())


async def _background_post_chat(session_id: str, connection_id: str | None = None, state_connection_id: str | None = None) -> None:
    """Background task: summarize and extract state after chat completes."""
    try:
        branch_msgs = await get_branch_messages(session_id)

        # Summarize if needed
        if await should_summarize(session_id, branch_msgs):
            await _push_to_session(session_id, WSMessageOut(type="summary_progress", status="running"))
            await incremental_summarize(session_id, branch_msgs, connection_id=connection_id)
            await event_bus.emit("summary_complete", session_id=session_id)

        # Extract state — use state_connection_id if specified, otherwise fall back to connection_id
        effective_state_conn = state_connection_id or connection_id
        state = await extract_state(session_id, branch_msgs, connection_id=effective_state_conn)
        await event_bus.emit("state_updated", session_id=session_id, data=state.model_dump())

    except Exception:
        log.exception("background_post_chat_failed", session_id=session_id)


# REST endpoints for message history

@router.get("/chat/{session_id}/messages", response_model=MessagesResponse)
async def get_messages(session_id: str, branch: str | None = Query(None)):
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
    session = await load_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    try:
        await delete_messages_from(session_id, from_message_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"ok": True}
