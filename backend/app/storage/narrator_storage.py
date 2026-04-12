from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import aiofiles
import structlog

from app.config import settings
from app.storage.base import get_data_dir

log = structlog.get_logger()


def _session_dir(session_id: str) -> Path:
    d = get_data_dir() / "sessions" / session_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def _narrator_path(session_id: str) -> Path:
    return _session_dir(session_id) / "narrator.json"


async def save_narrator(session_id: str, data: dict[str, Any]) -> None:
    path = _narrator_path(session_id)
    tmp = path.with_suffix(".json.tmp")
    async with aiofiles.open(tmp, "w", encoding="utf-8") as f:
        await f.write(json.dumps(data, ensure_ascii=False, indent=2))
    os.replace(str(tmp), str(path))


async def load_narrator(session_id: str) -> dict[str, Any] | None:
    path = _narrator_path(session_id)
    if not path.exists():
        return None
    async with aiofiles.open(path, "r", encoding="utf-8") as f:
        return json.loads(await f.read())


async def delete_narrator(session_id: str) -> bool:
    path = _narrator_path(session_id)
    if path.exists():
        path.unlink()
        return True
    return False
