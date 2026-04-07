from __future__ import annotations

import asyncio
from datetime import datetime

import structlog

from app.models.schemas import Message, SessionMeta, SummaryData, StateData
from app.storage.file_storage import read_json, write_json, generate_id
from app.services.token_counter import count_tokens

log = structlog.get_logger()

# Per-session concurrency lock for chat operations
_chat_locks: dict[str, asyncio.Lock] = {}


def _get_chat_lock(session_id: str) -> asyncio.Lock:
    if session_id not in _chat_locks:
        _chat_locks[session_id] = asyncio.Lock()
    return _chat_locks[session_id]


async def get_chat_lock(session_id: str) -> asyncio.Lock:
    return _get_chat_lock(session_id)


async def load_session(session_id: str) -> SessionMeta | None:
    data = await read_json(session_id, "session.json")
    if data is None:
        return None
    return SessionMeta(**data)


async def load_messages(session_id: str) -> list[Message]:
    data = await read_json(session_id, "messages.json")
    if data is None:
        return []
    return [Message(**m) for m in data]


async def load_summary(session_id: str) -> SummaryData:
    data = await read_json(session_id, "summary.json")
    if data is None:
        return SummaryData()
    return SummaryData(**data)


async def load_state(session_id: str) -> StateData:
    data = await read_json(session_id, "state.json")
    if data is None:
        return StateData()
    return StateData(**data)


async def save_message(session_id: str, message: Message) -> None:
    messages = await load_messages(session_id)
    messages.append(message)
    await write_json(session_id, "messages.json", [m.model_dump() for m in messages])


async def get_branch_messages(session_id: str, branch_from_id: str | None = None) -> list[Message]:
    """Get the linear message path for the active branch.
    
    If branch_from_id is specified, trace from that message to root.
    Otherwise, use the session's active_branch path.
    """
    all_messages = await load_messages(session_id)
    if not all_messages:
        return []

    session = await load_session(session_id)
    if session is None:
        return []

    # Build a lookup by id
    by_id = {m.id: m for m in all_messages}

    if branch_from_id and branch_from_id in by_id:
        # Trace from branch_from_id to root
        chain: list[Message] = []
        current_id: str | None = branch_from_id
        while current_id and current_id in by_id:
            chain.append(by_id[current_id])
            current_id = by_id[current_id].parent_id
        chain.reverse()
        return chain

    if session.active_branch:
        # Use active_branch ordered ids
        return [by_id[mid] for mid in session.active_branch if mid in by_id]

    # Fallback: linear (messages without branching)
    return all_messages


async def add_message_to_branch(
    session_id: str,
    role: str,
    content: str,
    parent_id: str | None = None,
) -> Message:
    """Create a new message and append it to the active branch."""
    msg_id = generate_id()
    token_count = count_tokens(content)

    session = await load_session(session_id)
    if session is None:
        raise ValueError(f"Session {session_id} not found")

    # Determine parent
    if parent_id is None and session.active_branch:
        parent_id = session.active_branch[-1]

    branch_id = "main"

    msg = Message(
        id=msg_id,
        parent_id=parent_id,
        role=role,
        content=content,
        timestamp=datetime.now().isoformat(),
        token_count=token_count,
        branch_id=branch_id,
    )

    await save_message(session_id, msg)

    # Update active branch
    session.active_branch.append(msg_id)
    session.updated_at = datetime.now().isoformat()
    await write_json(session_id, "session.json", session.model_dump())

    return msg


async def create_branch_from(session_id: str, from_message_id: str) -> list[str]:
    """Create a new branch starting from a specific message.
    
    Returns the new active_branch path.
    """
    all_messages = await load_messages(session_id)
    by_id = {m.id: m for m in all_messages}

    if from_message_id not in by_id:
        raise ValueError(f"Message {from_message_id} not found")

    # Trace back to root to get the branch path
    chain: list[str] = []
    current_id: str | None = from_message_id
    while current_id and current_id in by_id:
        chain.append(current_id)
        current_id = by_id[current_id].parent_id
    chain.reverse()

    # Update session active branch
    session = await load_session(session_id)
    if session is None:
        raise ValueError(f"Session {session_id} not found")
    session.active_branch = chain
    session.updated_at = datetime.now().isoformat()
    await write_json(session_id, "session.json", session.model_dump())

    return chain
