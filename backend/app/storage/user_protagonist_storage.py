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


def _user_protagonists_dir() -> Path:
    d = get_data_dir() / "user_protagonists"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _user_protagonist_path(pid: str) -> Path:
    return _user_protagonists_dir() / f"{pid}.json"


async def save_user_protagonist(pid: str, data: dict[str, Any]) -> None:
    path = _user_protagonist_path(pid)
    tmp = path.with_suffix(".json.tmp")
    async with aiofiles.open(tmp, "w", encoding="utf-8") as f:
        await f.write(json.dumps(data, ensure_ascii=False, indent=2))
    os.replace(str(tmp), str(path))


async def load_user_protagonist(pid: str) -> dict[str, Any] | None:
    path = _user_protagonist_path(pid)
    if not path.exists():
        return None
    async with aiofiles.open(path, "r", encoding="utf-8") as f:
        return json.loads(await f.read())


async def list_user_protagonists() -> list[dict[str, Any]]:
    d = _user_protagonists_dir()
    result = []
    for f in sorted(d.iterdir()):
        if f.suffix == ".json":
            async with aiofiles.open(f, "r", encoding="utf-8") as fh:
                result.append(json.loads(await fh.read()))
    return result


async def delete_user_protagonist_file(pid: str) -> bool:
    path = _user_protagonist_path(pid)
    if path.exists():
        path.unlink()
        return True
    return False


async def clear_user_protagonist_default_flag() -> None:
    """Remove is_default from all user protagonists."""
    d = _user_protagonists_dir()
    for f in d.iterdir():
        if f.suffix == ".json":
            async with aiofiles.open(f, "r", encoding="utf-8") as fh:
                data = json.loads(await fh.read())
            if data.get("is_default"):
                data["is_default"] = False
                tmp = f.with_suffix(".json.tmp")
                async with aiofiles.open(tmp, "w", encoding="utf-8") as fh:
                    await fh.write(json.dumps(data, ensure_ascii=False, indent=2))
                os.replace(str(tmp), str(f))
