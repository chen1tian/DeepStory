from __future__ import annotations

import json
import os
from pathlib import Path

import aiofiles

from app.config import settings


def _rooms_dir() -> Path:
    d = settings.data_dir / "rooms"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _room_path(session_id: str) -> Path:
    return _rooms_dir() / f"{session_id}.json"


async def save_room_state(session_id: str, data: dict) -> None:
    path = _room_path(session_id)
    tmp = path.with_suffix(".json.tmp")
    async with aiofiles.open(tmp, "w", encoding="utf-8") as f:
        await f.write(json.dumps(data, ensure_ascii=False, indent=2))
    os.replace(str(tmp), str(path))


async def load_room_state(session_id: str) -> dict | None:
    path = _room_path(session_id)
    if not path.exists():
        return None
    async with aiofiles.open(path, "r", encoding="utf-8") as f:
        return json.loads(await f.read())


async def load_all_room_states() -> list[dict]:
    rooms: list[dict] = []
    for path in _rooms_dir().glob("*.json"):
        async with aiofiles.open(path, "r", encoding="utf-8") as f:
            rooms.append(json.loads(await f.read()))
    return rooms


async def delete_room_state(session_id: str) -> None:
    path = _room_path(session_id)
    if path.exists():
        path.unlink()
