from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, HTTPException

from app.models.schemas import CreateSessionRequest, SessionResponse, SessionMeta
from app.storage.file_storage import (
    generate_id,
    write_json,
    read_json,
    list_sessions,
    delete_session,
)
from app.services.chat_manager import create_branch_from

router = APIRouter(tags=["sessions"])


@router.post("/sessions", response_model=SessionResponse)
async def create_session(req: CreateSessionRequest):
    session_id = generate_id()
    now = datetime.now().isoformat()
    session = SessionMeta(
        id=session_id,
        title=req.title,
        created_at=now,
        updated_at=now,
        system_prompt=req.system_prompt,
        active_branch=[],
    )
    await write_json(session_id, "session.json", session.model_dump())
    await write_json(session_id, "messages.json", [])
    return SessionResponse(
        id=session.id,
        title=session.title,
        created_at=session.created_at,
        updated_at=session.updated_at,
    )


@router.get("/sessions", response_model=list[SessionResponse])
async def get_sessions():
    sessions = await list_sessions()
    return [
        SessionResponse(
            id=s["id"],
            title=s.get("title", ""),
            created_at=s.get("created_at", ""),
            updated_at=s.get("updated_at", ""),
        )
        for s in sessions
    ]


@router.get("/sessions/{session_id}", response_model=SessionResponse)
async def get_session(session_id: str):
    data = await read_json(session_id, "session.json")
    if data is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return SessionResponse(
        id=data["id"],
        title=data.get("title", ""),
        created_at=data.get("created_at", ""),
        updated_at=data.get("updated_at", ""),
    )


@router.delete("/sessions/{session_id}")
async def remove_session(session_id: str):
    deleted = await delete_session(session_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "deleted"}


@router.post("/sessions/{session_id}/branch")
async def branch_from_message(session_id: str, message_id: str):
    try:
        new_branch = await create_branch_from(session_id, message_id)
        return {"active_branch": new_branch}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
