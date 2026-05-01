from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.models.schemas import StateData
from app.services.state_manager import get_state, get_cached_map, generate_ascii_map
from app.services import room_manager
from app.storage.base import set_user_id

router = APIRouter(tags=["state"])


@router.get("/state/{session_id}", response_model=StateData)
async def get_session_state(session_id: str):
    # Room: non-host members must read from host's data dir
    room = await room_manager.get_or_load_room(session_id)
    if room is not None:
        set_user_id(room.host_user_id)
    try:
        state = await get_state(session_id)
    except Exception:
        import structlog
        log = structlog.get_logger()
        log.exception("get_session_state_failed", session_id=session_id)
        state = StateData()
    return state


# ── Map endpoints ─────────────────────────────────────────────────────────────

class GenerateMapRequest(BaseModel):
    location: str = ""
    connections: dict[str, list[str]] = {}
    explored_locations: list[str] = []
    connection_id: str | None = None


@router.get("/sessions/{session_id}/map")
async def get_map(session_id: str):
    """Return the cached map for a session (no LLM call)."""
    data = await get_cached_map(session_id)
    if data is None:
        return {"ascii_map": None, "cache_key": None}
    return data


@router.post("/sessions/{session_id}/map/generate")
async def generate_map_endpoint(session_id: str, req: GenerateMapRequest):
    """Generate (or return cached) ASCII art map. Cached per location+explored combo."""
    result = await generate_ascii_map(
        session_id=session_id,
        location=req.location,
        connections=req.connections,
        explored=req.explored_locations,
        connection_id=req.connection_id,
    )
    return result
