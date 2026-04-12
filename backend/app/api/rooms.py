from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_current_user
from app.models.schemas import (
    CreateRoomRequest,
    JoinRoomRequest,
    JoinRoomResponse,
    RoomState,
)
from app.services import room_manager

router = APIRouter(tags=["rooms"])


@router.post("/rooms", response_model=RoomState)
async def create_room(
    req: CreateRoomRequest,
    user: dict = Depends(get_current_user),
):
    """Host creates a multiplayer room for a session they own."""
    existing = room_manager.get_room_by_session(req.session_id)
    if existing:
        # Already exists — return current state
        return existing
    room = await room_manager.create_room(
        session_id=req.session_id,
        host_user_id=user["id"],
        host_username=user["username"],
    )
    return room


@router.post("/rooms/join", response_model=JoinRoomResponse)
async def join_room(
    req: JoinRoomRequest,
    user: dict = Depends(get_current_user),
):
    room = room_manager.get_room_by_code(req.room_code)
    if room is None:
        raise HTTPException(status_code=404, detail="房间不存在或已关闭")
    if room.round_status == "processing":
        raise HTTPException(status_code=409, detail="当前回合正在处理中，请稍候加入")
    updated = await room_manager.join_room(
        session_id=room.session_id,
        user_id=user["id"],
        username=user["username"],
    )
    return JoinRoomResponse(session_id=room.session_id, room_state=updated)


@router.get("/rooms/{session_id}", response_model=RoomState)
async def get_room(
    session_id: str,
    user: dict = Depends(get_current_user),
):
    room = await room_manager.get_or_load_room(session_id)
    if room is None:
        raise HTTPException(status_code=404, detail="房间不存在")
    # Only members can view
    member_ids = {p.user_id for p in room.players}
    if user["id"] not in member_ids:
        raise HTTPException(status_code=403, detail="您不在此房间中")
    return room


@router.delete("/rooms/{session_id}", status_code=204)
async def close_room(
    session_id: str,
    user: dict = Depends(get_current_user),
):
    room = room_manager.get_room_by_session(session_id)
    if room is None:
        raise HTTPException(status_code=404, detail="房间不存在")
    if room.host_user_id != user["id"]:
        raise HTTPException(status_code=403, detail="只有房主可以关闭房间")
    await room_manager.close_room(session_id)


@router.delete("/rooms/{session_id}/leave", status_code=204)
async def leave_room(
    session_id: str,
    user: dict = Depends(get_current_user),
):
    room = room_manager.get_room_by_session(session_id)
    if room is None:
        return
    if room.host_user_id == user["id"]:
        # Host leaves → close room
        await room_manager.close_room(session_id)
    else:
        await room_manager.remove_player(session_id, user["id"])
