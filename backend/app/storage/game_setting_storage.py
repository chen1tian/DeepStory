from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import aiofiles

from app.storage.base import get_data_dir


def _settings_dir() -> Path:
    d = get_data_dir() / "settings"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _setting_path(setting_id: str) -> Path:
    return _settings_dir() / f"{setting_id}.json"


async def save_game_setting(setting_id: str, data: dict[str, Any]) -> None:
    path = _setting_path(setting_id)
    tmp = path.with_suffix(".json.tmp")
    async with aiofiles.open(tmp, "w", encoding="utf-8") as f:
        await f.write(json.dumps(data, ensure_ascii=False, indent=2))
    os.replace(str(tmp), str(path))


async def load_game_setting(setting_id: str) -> dict[str, Any] | None:
    path = _setting_path(setting_id)
    if not path.exists():
        return None
    async with aiofiles.open(path, "r", encoding="utf-8") as f:
        return json.loads(await f.read())


async def list_game_settings() -> list[dict[str, Any]]:
    result = []
    for f in sorted(_settings_dir().iterdir()):
        if f.suffix == ".json":
            async with aiofiles.open(f, "r", encoding="utf-8") as fh:
                result.append(json.loads(await fh.read()))
    return result


async def delete_game_setting_file(setting_id: str) -> bool:
    path = _setting_path(setting_id)
    if path.exists():
        path.unlink()
        return True
    return False
