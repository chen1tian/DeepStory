from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import aiofiles
import structlog

from app.config import settings

log = structlog.get_logger()


def _protagonists_dir() -> Path:
    d = settings.data_dir / "protagonists"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _protagonist_path(pid: str) -> Path:
    return _protagonists_dir() / f"{pid}.json"


async def save_protagonist(pid: str, data: dict[str, Any]) -> None:
    path = _protagonist_path(pid)
    tmp = path.with_suffix(".json.tmp")
    async with aiofiles.open(tmp, "w", encoding="utf-8") as f:
        await f.write(json.dumps(data, ensure_ascii=False, indent=2))
    os.replace(str(tmp), str(path))


async def load_protagonist(pid: str) -> dict[str, Any] | None:
    path = _protagonist_path(pid)
    if not path.exists():
        return None
    async with aiofiles.open(path, "r", encoding="utf-8") as f:
        return json.loads(await f.read())


async def list_protagonists() -> list[dict[str, Any]]:
    d = _protagonists_dir()
    result = []
    for f in sorted(d.iterdir()):
        if f.suffix == ".json":
            async with aiofiles.open(f, "r", encoding="utf-8") as fh:
                result.append(json.loads(await fh.read()))
    return result


async def delete_protagonist_file(pid: str) -> bool:
    path = _protagonist_path(pid)
    if path.exists():
        path.unlink()
        return True
    return False


async def clear_default_flag() -> None:
    """Remove is_default from all protagonists."""
    d = _protagonists_dir()
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
