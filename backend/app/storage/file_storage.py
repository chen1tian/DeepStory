from __future__ import annotations

import asyncio
import json
import os
import re
import uuid
from pathlib import Path
from typing import Any

import aiofiles
import structlog

from app.config import settings

log = structlog.get_logger()

_UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)

# Per-session locks to prevent concurrent writes
_locks: dict[str, asyncio.Lock] = {}


def _get_lock(session_id: str) -> asyncio.Lock:
    if session_id not in _locks:
        _locks[session_id] = asyncio.Lock()
    return _locks[session_id]


def _validate_session_id(session_id: str) -> None:
    if not _UUID_RE.match(session_id):
        raise ValueError(f"Invalid session_id: {session_id}")


def _session_dir(session_id: str) -> Path:
    _validate_session_id(session_id)
    return settings.data_dir / "sessions" / session_id


async def _atomic_write(path: Path, data: str) -> None:
    """Write to a temp file then rename for atomicity."""
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    async with aiofiles.open(tmp_path, "w", encoding="utf-8") as f:
        await f.write(data)
    os.replace(str(tmp_path), str(path))


async def read_json(session_id: str, filename: str) -> Any:
    _validate_session_id(session_id)
    path = _session_dir(session_id) / filename
    if not path.exists():
        return None
    async with aiofiles.open(path, "r", encoding="utf-8") as f:
        content = await f.read()
    return json.loads(content)


async def write_json(session_id: str, filename: str, data: Any) -> None:
    _validate_session_id(session_id)
    lock = _get_lock(session_id)
    async with lock:
        d = _session_dir(session_id)
        d.mkdir(parents=True, exist_ok=True)
        await _atomic_write(d / filename, json.dumps(data, ensure_ascii=False, indent=2))


async def read_text(session_id: str, filename: str) -> str | None:
    _validate_session_id(session_id)
    path = _session_dir(session_id) / filename
    if not path.exists():
        return None
    async with aiofiles.open(path, "r", encoding="utf-8") as f:
        return await f.read()


async def write_text(session_id: str, filename: str, content: str) -> None:
    _validate_session_id(session_id)
    lock = _get_lock(session_id)
    async with lock:
        d = _session_dir(session_id)
        d.mkdir(parents=True, exist_ok=True)
        await _atomic_write(d / filename, content)


async def list_sessions() -> list[dict]:
    sessions_dir = settings.data_dir / "sessions"
    if not sessions_dir.exists():
        return []
    result = []
    for entry in sorted(sessions_dir.iterdir()):
        if entry.is_dir() and _UUID_RE.match(entry.name):
            session_file = entry / "session.json"
            if session_file.exists():
                async with aiofiles.open(session_file, "r", encoding="utf-8") as f:
                    data = json.loads(await f.read())
                result.append(data)
    return result


async def delete_session(session_id: str) -> bool:
    _validate_session_id(session_id)
    import shutil
    d = _session_dir(session_id)
    if d.exists():
        shutil.rmtree(d)
        _locks.pop(session_id, None)
        return True
    return False


def generate_id() -> str:
    return str(uuid.uuid4())
