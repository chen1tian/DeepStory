from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException

from app.models.schemas import (
    CreateGameSettingRequest,
    GameSetting,
    UpdateGameSettingRequest,
)
from app.storage.file_storage import read_json, write_json
from app.storage.game_setting_storage import (
    delete_game_setting_file,
    list_game_settings,
    load_game_setting,
    save_game_setting,
)

router = APIRouter(tags=["settings"])


@router.post("/settings", response_model=GameSetting)
async def create_game_setting(req: CreateGameSettingRequest):
    setting_id = str(uuid.uuid4())
    now = datetime.now().isoformat()
    item = GameSetting(
        id=setting_id,
        name=req.name,
        description=req.description,
        content=req.content,
        created_at=now,
        updated_at=now,
    )
    await save_game_setting(setting_id, item.model_dump())
    return item


@router.get("/settings", response_model=list[GameSetting])
async def get_game_settings():
    return await list_game_settings()


@router.get("/settings/{setting_id}", response_model=GameSetting)
async def get_game_setting(setting_id: str):
    data = await load_game_setting(setting_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Setting not found")
    return GameSetting(**data)


@router.put("/settings/{setting_id}", response_model=GameSetting)
async def update_game_setting(setting_id: str, req: UpdateGameSettingRequest):
    data = await load_game_setting(setting_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Setting not found")
    data.update(req.model_dump(exclude_none=True))
    data["updated_at"] = datetime.now().isoformat()
    await save_game_setting(setting_id, data)
    return GameSetting(**data)


@router.delete("/settings/{setting_id}")
async def delete_game_setting(setting_id: str):
    ok = await delete_game_setting_file(setting_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Setting not found")
    return {"status": "deleted"}


@router.post("/sessions/{session_id}/settings/{setting_id}")
async def add_setting_to_session(session_id: str, setting_id: str):
    if await load_game_setting(setting_id) is None:
        raise HTTPException(status_code=404, detail="Setting not found")

    data = await read_json(session_id, "session.json")
    if data is None:
        raise HTTPException(status_code=404, detail="Session not found")

    active_ids = list(data.get("active_setting_ids", []))
    if setting_id not in active_ids:
        active_ids.append(setting_id)
    data["active_setting_ids"] = active_ids
    data["updated_at"] = datetime.now().isoformat()
    await write_json(session_id, "session.json", data)
    return {"active_setting_ids": active_ids}


@router.delete("/sessions/{session_id}/settings/{setting_id}")
async def remove_setting_from_session(session_id: str, setting_id: str):
    data = await read_json(session_id, "session.json")
    if data is None:
        raise HTTPException(status_code=404, detail="Session not found")

    active_ids = [sid for sid in data.get("active_setting_ids", []) if sid != setting_id]
    data["active_setting_ids"] = active_ids
    data["updated_at"] = datetime.now().isoformat()
    await write_json(session_id, "session.json", data)
    return {"active_setting_ids": active_ids}
