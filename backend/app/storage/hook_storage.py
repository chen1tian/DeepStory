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


def _hooks_dir() -> Path:
    d = get_data_dir() / "hooks"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _hook_path(hook_id: str) -> Path:
    return _hooks_dir() / f"{hook_id}.json"


async def save_hook(hook_id: str, data: dict[str, Any]) -> None:
    path = _hook_path(hook_id)
    tmp = path.with_suffix(".json.tmp")
    async with aiofiles.open(tmp, "w", encoding="utf-8") as f:
        await f.write(json.dumps(data, ensure_ascii=False, indent=2))
    os.replace(str(tmp), str(path))


async def load_hook(hook_id: str) -> dict[str, Any] | None:
    path = _hook_path(hook_id)
    if not path.exists():
        return None
    async with aiofiles.open(path, "r", encoding="utf-8") as f:
        return json.loads(await f.read())


async def list_hooks() -> list[dict[str, Any]]:
    d = _hooks_dir()
    result = []
    for f in sorted(d.iterdir()):
        if f.suffix == ".json":
            async with aiofiles.open(f, "r", encoding="utf-8") as fh:
                result.append(json.loads(await fh.read()))
    return result


async def delete_hook_file(hook_id: str) -> bool:
    path = _hook_path(hook_id)
    if path.exists():
        path.unlink()
        return True
    return False
