from __future__ import annotations

import json
import os
import uuid
from pathlib import Path
from typing import Any

import aiofiles
import structlog

from app.config import settings
from app.storage.base import get_data_dir

log = structlog.get_logger()


def _stories_dir() -> Path:
    d = get_data_dir() / "stories"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _story_path(story_id: str) -> Path:
    return _stories_dir() / f"{story_id}.json"


async def save_story(story_id: str, data: dict[str, Any]) -> None:
    path = _story_path(story_id)
    tmp = path.with_suffix(".json.tmp")
    async with aiofiles.open(tmp, "w", encoding="utf-8") as f:
        await f.write(json.dumps(data, ensure_ascii=False, indent=2))
    os.replace(str(tmp), str(path))


async def load_story(story_id: str) -> dict[str, Any] | None:
    path = _story_path(story_id)
    if not path.exists():
        return None
    async with aiofiles.open(path, "r", encoding="utf-8") as f:
        return json.loads(await f.read())


async def list_stories() -> list[dict[str, Any]]:
    d = _stories_dir()
    result = []
    for f in sorted(d.iterdir()):
        if f.suffix == ".json":
            async with aiofiles.open(f, "r", encoding="utf-8") as fh:
                result.append(json.loads(await fh.read()))
    return result


async def delete_story_file(story_id: str) -> bool:
    path = _story_path(story_id)
    if path.exists():
        path.unlink()
        return True
    return False
