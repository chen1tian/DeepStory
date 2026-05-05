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
from app.services.event_bus import event_bus
from app.services.chat_manager import load_session
from app.storage.user_protagonist_storage import load_user_protagonist

router = APIRouter(tags=["rooms"])


def _extract_protagonist(pdata: dict | None) -> tuple[str, str, str | None, str]:
    """Return (name, avatar_emoji, avatar_url, setting) from protagonist dict."""
    if not pdata:
        return "", "🧑", None, ""
    return pdata.get("name", ""), pdata.get("avatar_emoji", "🧑"), pdata.get("avatar_url"), pdata.get("setting", "")


@router.post("/rooms", response_model=RoomState)
async def create_room(
    req: CreateRoomRequest,
    user: dict = Depends(get_current_user),
):
    """Host creates a multiplayer room for a session they own."""
    existing = await room_manager.get_or_load_room(req.session_id)
    if existing:
        # Already exists — return current state
        return existing
    # Load host protagonist from their session
    session = await load_session(req.session_id)
    pname, pavatar, pavatar_url, psetting = "", "🧑", None, ""
    if session and session.user_protagonist_id:
        pdata = await load_user_protagonist(session.user_protagonist_id)
        pname, pavatar, pavatar_url, psetting = _extract_protagonist(pdata)
    room = await room_manager.create_room(
        session_id=req.session_id,
        host_user_id=user["id"],
        host_username=user["username"],
        protagonist_name=pname,
        protagonist_avatar=pavatar,
        protagonist_avatar_url=pavatar_url,
        protagonist_setting=psetting,
    )
    return room


@router.post("/rooms/join", response_model=JoinRoomResponse)
async def join_room(
    req: JoinRoomRequest,
    user: dict = Depends(get_current_user),
):
    room = await room_manager.get_or_load_room_by_code(req.room_code)
    if room is None:
        raise HTTPException(status_code=404, detail="房间不存在或已关闭")
    if room.round_status == "processing":
        raise HTTPException(status_code=409, detail="当前回合正在处理中，请稍候加入")
    # Load player's protagonist (get_current_user already set their data dir)
    pname, pavatar, pavatar_url, psetting = "", "🧑", None, ""
    if req.user_protagonist_id:
        pdata = await load_user_protagonist(req.user_protagonist_id)
        pname, pavatar, pavatar_url, psetting = _extract_protagonist(pdata)
    updated = await room_manager.join_room(
        session_id=room.session_id,
        user_id=user["id"],
        username=user["username"],
        protagonist_name=pname,
        protagonist_avatar=pavatar,
        protagonist_avatar_url=pavatar_url,
        protagonist_setting=psetting,
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
    room = await room_manager.get_or_load_room(session_id)
    if room is None:
        raise HTTPException(status_code=404, detail="房间不存在")
    if room.host_user_id != user["id"]:
        raise HTTPException(status_code=403, detail="只有房主可以关闭房间")
    await room_manager.close_room(session_id)
    await event_bus.emit("room_closed", session_id=session_id, reason="房主已关闭房间")


@router.delete("/rooms/{session_id}/leave", status_code=204)
async def leave_room(
    session_id: str,
    user: dict = Depends(get_current_user),
):
    room = await room_manager.get_or_load_room(session_id)
    if room is None:
        return
    if room.host_user_id == user["id"]:
        # Host leaves → close room
        await room_manager.close_room(session_id)
        await event_bus.emit("room_closed", session_id=session_id, reason="房主已关闭房间")
    else:
        await room_manager.remove_player(session_id, user["id"])
