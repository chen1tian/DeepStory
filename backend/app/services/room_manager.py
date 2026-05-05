from __future__ import annotations

import random
import string
from collections.abc import Iterable

import structlog

from app.models.schemas import PlayerInfo, RoomState
from app.storage.room_storage import delete_room_state, load_all_room_states, load_room_state, save_room_state

log = structlog.get_logger()

# In-memory index
_rooms: dict[str, RoomState] = {}          # session_id -> RoomState
_code_to_session: dict[str, str] = {}      # room_code -> session_id


def _generate_room_code() -> str:
    chars = string.ascii_uppercase + string.digits
    while True:
        code = "".join(random.choices(chars, k=6))
        if code not in _code_to_session:
            return code


async def create_room(session_id: str, host_user_id: str, host_username: str,
                      protagonist_name: str = "", protagonist_avatar: str = "🧑",
                      protagonist_avatar_url: str | None = None,
                      protagonist_setting: str = "") -> RoomState:
    code = _generate_room_code()
    host = PlayerInfo(
        user_id=host_user_id, username=host_username, is_host=True, is_online=True,
        protagonist_name=protagonist_name, protagonist_avatar=protagonist_avatar,
        protagonist_avatar_url=protagonist_avatar_url,
        protagonist_setting=protagonist_setting,
    )
    room = RoomState(
        room_code=code,
        session_id=session_id,
        host_user_id=host_user_id,
        players=[host],
    )
    _rooms[session_id] = room
    _code_to_session[code] = session_id
    await save_room_state(session_id, room.model_dump())
    log.info("room_created", session_id=session_id, code=code)
    return room


async def _load_from_storage(session_id: str) -> RoomState | None:
    data = await load_room_state(session_id)
    if data is None:
        return None
    room = RoomState(**data)
    _rooms[session_id] = room
    _code_to_session[room.room_code] = session_id
    return room


def _cache_room(room: RoomState) -> RoomState:
    _rooms[room.session_id] = room
    _code_to_session[room.room_code.upper()] = room.session_id
    return room


def _normalize_code(code: str) -> str:
    return code.strip().upper()


def get_room_by_code(code: str) -> RoomState | None:
    session_id = _code_to_session.get(_normalize_code(code))
    if session_id is None:
        return None
    return _rooms.get(session_id)


def get_room_by_session(session_id: str) -> RoomState | None:
    return _rooms.get(session_id)


async def get_or_load_room(session_id: str) -> RoomState | None:
    room = _rooms.get(session_id)
    if room is not None:
        return room
    return await _load_from_storage(session_id)


async def get_or_load_room_by_code(code: str) -> RoomState | None:
    normalized = _normalize_code(code)
    session_id = _code_to_session.get(normalized)
    if session_id:
        room = _rooms.get(session_id)
        if room is not None and _normalize_code(room.room_code) == normalized:
            return room
        data = await load_room_state(session_id)
        if data is not None:
            room = RoomState(**data)
            if _normalize_code(room.room_code) == normalized:
                return _cache_room(room)
        _code_to_session.pop(normalized, None)

    stored_rooms = await load_all_room_states()
    for data in stored_rooms:
        room = RoomState(**data)
        if _normalize_code(room.room_code) == normalized:
            return _cache_room(room)
    return None


async def join_room(session_id: str, user_id: str, username: str,
                    protagonist_name: str = "", protagonist_avatar: str = "🧑",
                    protagonist_avatar_url: str | None = None,
                    protagonist_setting: str = "") -> RoomState:
    room = _rooms[session_id]
    # Update if already in player list (reconnect)
    for p in room.players:
        if p.user_id == user_id:
            p.is_online = True
            if protagonist_name:
                p.protagonist_name = protagonist_name
                p.protagonist_avatar = protagonist_avatar
                p.protagonist_avatar_url = protagonist_avatar_url
                p.protagonist_setting = protagonist_setting
            await save_room_state(session_id, room.model_dump())
            return room
    room.players.append(PlayerInfo(
        user_id=user_id, username=username,
        protagonist_name=protagonist_name, protagonist_avatar=protagonist_avatar,
        protagonist_avatar_url=protagonist_avatar_url,
        protagonist_setting=protagonist_setting,
    ))
    await save_room_state(session_id, room.model_dump())
    return room


async def set_player_online(session_id: str, user_id: str, online: bool) -> RoomState | None:
    room = _rooms.get(session_id)
    if room is None:
        return None
    for p in room.players:
        if p.user_id == user_id:
            p.is_online = online
            break
    await save_room_state(session_id, room.model_dump())
    return room


async def submit_turn(session_id: str, user_id: str, content: str) -> tuple[RoomState, bool]:
    """Submit a player's turn. Returns (room, all_online_submitted)."""
    room = _rooms[session_id]
    room.pending_turns[user_id] = content
    # Mark player as submitted
    for p in room.players:
        if p.user_id == user_id:
            p.has_submitted = True
            break
    # Check if all online players have submitted
    online_players = [p for p in room.players if p.is_online]
    all_submitted = all(p.has_submitted for p in online_players)
    await save_room_state(session_id, room.model_dump())
    return room, all_submitted


async def retract_turn(session_id: str, user_id: str) -> RoomState:
    room = _rooms[session_id]
    room.pending_turns.pop(user_id, None)
    for p in room.players:
        if p.user_id == user_id:
            p.has_submitted = False
            break
    await save_room_state(session_id, room.model_dump())
    return room


async def start_processing(session_id: str) -> RoomState:
    room = _rooms[session_id]
    room.round_status = "processing"
    await save_room_state(session_id, room.model_dump())
    return room


async def end_round(session_id: str) -> RoomState:
    room = _rooms[session_id]
    room.pending_turns.clear()
    room.round_status = "collecting"
    for p in room.players:
        p.has_submitted = False
    await save_room_state(session_id, room.model_dump())
    return room


async def remove_player(session_id: str, user_id: str) -> RoomState | None:
    room = _rooms.get(session_id)
    if room is None:
        return None
    room.players = [p for p in room.players if p.user_id != user_id]
    room.pending_turns.pop(user_id, None)
    await save_room_state(session_id, room.model_dump())
    return room


async def close_room(session_id: str) -> None:
    room = _rooms.pop(session_id, None)
    if room is None:
        data = await load_room_state(session_id)
        if data is not None:
            room = RoomState(**data)
    if room:
        _code_to_session.pop(_normalize_code(room.room_code), None)
    await delete_room_state(session_id)
    log.info("room_closed", session_id=session_id)


def build_combined_content(room: RoomState) -> str:
    """Merge all submitted player turns into a single user message, in submission order."""
    player_map = {p.user_id: p for p in room.players}
    parts = []
    for user_id, content in room.pending_turns.items():  # insertion = submission order
        content = content.strip()
        if not content:
            continue
        player = player_map.get(user_id)
        if player is None:
            continue
        label = player.protagonist_name or player.username
        parts.append(f"[{label}]: {content}")
    return "\n".join(parts)
