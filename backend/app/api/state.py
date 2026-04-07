from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models.schemas import StateData
from app.services.state_manager import get_state

router = APIRouter(tags=["state"])


@router.get("/state/{session_id}", response_model=StateData)
async def get_session_state(session_id: str):
    state = await get_state(session_id)
    return state
