from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException

from app.models.schemas import (
    Preset,
    CreatePresetRequest,
    UpdatePresetRequest,
)
from app.storage.preset_storage import (
    save_preset,
    load_preset,
    list_presets,
    delete_preset_file,
    clear_default_flag,
)

router = APIRouter(tags=["presets"])


@router.post("/presets", response_model=Preset)
async def create_preset(req: CreatePresetRequest):
    pid = str(uuid.uuid4())
    now = datetime.now().isoformat()

    if req.is_default:
        await clear_default_flag()

    p = Preset(
        id=pid,
        name=req.name,
        description=req.description,
        content=req.content,
        is_default=req.is_default,
        created_at=now,
        updated_at=now,
    )
    await save_preset(pid, p.model_dump())
    return p


@router.get("/presets", response_model=list[Preset])
async def get_presets():
    return await list_presets()


@router.get("/presets/{pid}", response_model=Preset)
async def get_preset(pid: str):
    data = await load_preset(pid)
    if data is None:
        raise HTTPException(status_code=404, detail="Preset not found")
    return Preset(**data)


@router.put("/presets/{pid}", response_model=Preset)
async def update_preset(pid: str, req: UpdatePresetRequest):
    data = await load_preset(pid)
    if data is None:
        raise HTTPException(status_code=404, detail="Preset not found")

    updates = req.model_dump(exclude_none=True)

    if updates.get("is_default"):
        await clear_default_flag()

    data.update(updates)
    data["updated_at"] = datetime.now().isoformat()
    await save_preset(pid, data)
    return Preset(**data)


@router.delete("/presets/{pid}")
async def delete_preset(pid: str):
    ok = await delete_preset_file(pid)
    if not ok:
        raise HTTPException(status_code=404, detail="Preset not found")
    return {"status": "deleted"}
