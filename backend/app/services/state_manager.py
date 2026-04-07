from __future__ import annotations

import structlog

from app.models.schemas import StateData
from app.storage.file_storage import read_json, write_json

log = structlog.get_logger()


async def get_state(session_id: str) -> StateData:
    data = await read_json(session_id, "state.json")
    if data is None:
        return StateData()
    return StateData(**data)


async def update_state(session_id: str, state: StateData) -> None:
    await write_json(session_id, "state.json", state.model_dump())
