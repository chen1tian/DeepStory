from __future__ import annotations

import json
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

import aiofiles
import structlog

from app.config import settings
from app.storage.base import get_data_dir

log = structlog.get_logger()


def _connections_dir() -> Path:
    d = get_data_dir() / "connections"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _connection_path(connection_id: str) -> Path:
    return _connections_dir() / f"{connection_id}.json"


async def save_connection(connection_id: str, data: dict[str, Any]) -> None:
    path = _connection_path(connection_id)
    tmp = path.with_suffix(".json.tmp")
    async with aiofiles.open(tmp, "w", encoding="utf-8") as f:
        await f.write(json.dumps(data, ensure_ascii=False, indent=2))
    os.replace(str(tmp), str(path))


async def load_connection(connection_id: str) -> dict[str, Any] | None:
    path = _connection_path(connection_id)
    if not path.exists():
        return None
    async with aiofiles.open(path, "r", encoding="utf-8") as f:
        return json.loads(await f.read())


async def list_connections() -> list[dict[str, Any]]:
    d = _connections_dir()
    result = []
    for f in sorted(d.iterdir()):
        if f.suffix == ".json":
            try:
                async with aiofiles.open(f, "r", encoding="utf-8") as fh:
                    result.append(json.loads(await fh.read()))
            except Exception as e:
                log.warning("failed_to_load_connection_file", file=str(f), error=str(e))
    
    # If no connections exist, auto-create one from .env settings
    if len(result) == 0:
        default_conn = {
            "id": str(uuid.uuid4()),
            "name": "默认连接 (从 .env 加载)",
            "connection_type": "llm",
            "api_key": settings.api_key or "",
            "api_base_url": str(settings.api_base_url) if settings.api_base_url else "https://api.openai.com/v1",
            "model_name": settings.model_name or "gpt-4o-mini",
            "is_default": True,
            "image_gen_config": None,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
        await save_connection(default_conn["id"], default_conn)
        result.append(default_conn)
        
    return result


async def delete_connection_file(connection_id: str) -> bool:
    path = _connection_path(connection_id)
    if path.exists():
        path.unlink()
        return True
    return False


async def clear_default_flag() -> None:
    """Remove is_default from all connections."""
    d = _connections_dir()
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
