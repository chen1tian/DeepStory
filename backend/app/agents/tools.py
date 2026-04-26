"""Shared tools for all agents.

Each tool is an async function wrapping an existing service operation.
Tools are designed to be used with deepagents' tool system.
All tools use type annotations for automatic schema inference.
"""

from __future__ import annotations

import contextvars
from typing import Any

import structlog

from app.models.schemas import Message, WSMessageOut
from app.services.llm_service import chat_completion_stream
from app.services.chat_manager import (
    add_message_to_branch,
    create_branch_from,
    get_branch_messages,
    load_session,
    load_summary,
    load_state,
)
from app.services.prompt_builder import build_chat_messages
from app.services.summarizer import (
    should_summarize as _should_summarize,
    incremental_summarize as _incremental_summarize,
    extract_state as _extract_state,
)

log = structlog.get_logger()

# Context variable for injecting the WebSocket push function into tools
_current_push_fn: contextvars.ContextVar[Any] = contextvars.ContextVar(
    "push_fn", default=None
)


def set_push_fn(fn: Any) -> None:
    """Set the WebSocket push function for the current request context."""
    _current_push_fn.set(fn)


def get_push_fn() -> Any:
    """Get the WebSocket push function for the current request context."""
    return _current_push_fn.get()


# ── Phase 1 Chat Tools ──


async def save_user_message(
    session_id: str,
    content: str,
    parent_id: str | None = None,
) -> dict:
    """Save the user's chat message and return it."""
    msg = await add_message_to_branch(session_id, "user", content, parent_id)
    return msg.model_dump()


async def save_assistant_message(
    session_id: str,
    content: str,
) -> dict:
    """Save the assistant's response message and return it."""
    msg = await add_message_to_branch(session_id, "assistant", content)
    return msg.model_dump()


async def load_context(session_id: str) -> dict:
    """Load all session context: session meta, branch messages, summary, and state."""
    session = await load_session(session_id)
    branch_msgs = await get_branch_messages(session_id)
    summary = await load_summary(session_id)
    state = await load_state(session_id)

    return {
        "session": session.model_dump() if session else None,
        "branch_messages": [m.model_dump() for m in branch_msgs],
        "summary": summary.model_dump(),
        "state": state.model_dump(),
    }


async def build_prompt(
    system_prompt: str = "",
    state: dict | None = None,
    summary: dict | None = None,
    recent_messages: list[dict] | None = None,
    user_input: str = "",
    characters: list[dict] | None = None,
    user_protagonist: dict | None = None,
    narrator_directives: list[dict] | None = None,
    room_players: list[dict] | None = None,
) -> dict:
    """Build the full message array with token budgeting for the LLM call."""
    from app.services.chat_manager import SessionMeta
    from app.models.schemas import SummaryData, StateData

    messages, budget_info = await build_chat_messages(
        system_prompt=system_prompt,
        state=StateData(**state) if state else None,
        summary=SummaryData(**summary) if summary else None,
        recent_messages=[Message(**m) for m in (recent_messages or [])],
        user_input=user_input,
        characters=characters or [],
        user_protagonist=user_protagonist,
        narrator_directives=narrator_directives,
        room_players=room_players,
    )

    return {
        "messages": messages,
        "budget_info": budget_info,
    }


async def stream_response(
    messages: list[dict],
    connection_id: str | None = None,
) -> str:
    """Stream LLM tokens to the WebSocket and return the full response text."""
    full_response = ""
    push_fn = get_push_fn()
    async for token in chat_completion_stream(messages, connection_id=connection_id):
        full_response += token
        if push_fn:
            await push_fn(WSMessageOut(type="token", content=token))
    return full_response


# ── Phase 2 Metadata Tools ──


async def check_should_summarize(
    session_id: str,
    branch_messages: list[dict],
) -> bool:
    """Check if the conversation needs incremental summarization."""
    msgs = [Message(**m) for m in branch_messages]
    return await _should_summarize(session_id, msgs)


async def summarize_conversation(
    session_id: str,
    branch_messages: list[dict],
    connection_id: str | None = None,
) -> dict:
    """Perform incremental summarization of the conversation."""
    msgs = [Message(**m) for m in branch_messages]
    push_fn = get_push_fn()
    if push_fn:
        await push_fn(WSMessageOut(type="summary_progress", status="running"))
    result = await _incremental_summarize(session_id, msgs, connection_id=connection_id)
    return result.model_dump()


async def extract_rpg_state(
    session_id: str,
    branch_messages: list[dict],
    connection_id: str | None = None,
) -> dict:
    """Extract RPG state delta from recent messages and apply to full state."""
    msgs = [Message(**m) for m in branch_messages]
    from app.services.event_bus import event_bus

    state = await _extract_state(session_id, msgs, connection_id=connection_id)
    await event_bus.emit("state_updated", session_id=session_id, data=state.model_dump())
    return state.model_dump()


# ── Hook Tools ──


async def read_rpg_state(session_id: str) -> dict:
    """Read the current RPG state for a session."""
    state = await load_state(session_id)
    return state.model_dump()


async def read_conversation_context(
    session_id: str,
    message_count: int = 10,
) -> list[dict]:
    """Read the most recent N messages from the active branch."""
    msgs = await get_branch_messages(session_id)
    recent = msgs[-message_count:] if message_count > 0 else msgs
    return [m.model_dump() for m in recent]


async def dispatch_hook_result(
    hook_id: str,
    hook_name: str,
    action: dict,
    result: Any,
) -> None:
    """Push a hook result to all WebSocket connections for the session."""
    push_fn = get_push_fn()
    if not push_fn:
        log.warning("hook_dispatch_no_push_fn", hook_id=hook_id)
        return
    await push_fn(WSMessageOut(
        type="hook_result",
        data={
            "hook_id": hook_id,
            "hook_name": hook_name,
            "action": action,
            "result": result,
        },
    ))


async def generate_image_tool(
    prompt: str,
    connection_id: str | None = None,
    size: str = "1024x1024",
    style: str = "default",
) -> dict:
    """Generate an AI image using the configured image generation connection."""
    from app.services.image_gen_service import test_connection, generate_image

    try:
        result = await generate_image(
            prompt=prompt,
            connection_id=connection_id,
            size=size,
            style=style,
        )
        return result
    except Exception as e:
        log.exception("image_gen_tool_failed", prompt=prompt[:80])
        return {"error": str(e)}


# ── Narrator Tools ──


async def narrator_evaluate_tool(
    session_id: str,
    branch_messages: list[dict],
    state: dict | None = None,
    connection_id: str | None = None,
) -> dict:
    """Evaluate story arc progression and generate narrative directives."""
    from app.services.narrator_service import evaluate_and_direct
    from app.models.schemas import StateData

    msgs = [Message(**m) for m in branch_messages]
    state_data = StateData(**state) if state else None

    result = await evaluate_and_direct(
        session_id=session_id,
        branch_msgs=msgs,
        state=state_data,
        connection_id=connection_id,
    )
    return result


async def push_ws_message(
    type: str,
    content: str = "",
    data: dict | None = None,
    message_id: str = "",
) -> None:
    """Push a WebSocket message to the current session's connections."""
    push_fn = get_push_fn()
    if not push_fn:
        return
    await push_fn(WSMessageOut(
        type=type,
        content=content,
        data=data,
        message_id=message_id,
    ))
