from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException

from app.models.schemas import (
    Protagonist,
    CreateProtagonistRequest,
    UpdateProtagonistRequest,
)
from app.storage.protagonist_storage import (
    save_protagonist,
    load_protagonist,
    list_protagonists,
    delete_protagonist_file,
    clear_default_flag,
)

router = APIRouter(tags=["protagonists"])


@router.post("/protagonists", response_model=Protagonist)
async def create_protagonist(req: CreateProtagonistRequest):
    pid = str(uuid.uuid4())
    now = datetime.now().isoformat()

    if req.is_default:
        await clear_default_flag()

    p = Protagonist(
        id=pid,
        name=req.name,
        setting=req.setting,
        avatar_emoji=req.avatar_emoji,
        is_default=req.is_default,
        created_at=now,
        updated_at=now,
    )
    await save_protagonist(pid, p.model_dump())
    return p


@router.get("/protagonists", response_model=list[Protagonist])
async def get_protagonists():
    return await list_protagonists()


@router.get("/protagonists/{pid}", response_model=Protagonist)
async def get_protagonist(pid: str):
    data = await load_protagonist(pid)
    if data is None:
        raise HTTPException(status_code=404, detail="Protagonist not found")
    return Protagonist(**data)


@router.put("/protagonists/{pid}", response_model=Protagonist)
async def update_protagonist(pid: str, req: UpdateProtagonistRequest):
    data = await load_protagonist(pid)
    if data is None:
        raise HTTPException(status_code=404, detail="Protagonist not found")

    updates = req.model_dump(exclude_none=True)

    # If setting as default, clear others first
    if updates.get("is_default"):
        await clear_default_flag()

    data.update(updates)
    data["updated_at"] = datetime.now().isoformat()
    await save_protagonist(pid, data)
    return Protagonist(**data)


@router.delete("/protagonists/{pid}")
async def delete_protagonist(pid: str):
    ok = await delete_protagonist_file(pid)
    if not ok:
        raise HTTPException(status_code=404, detail="Protagonist not found")
    return {"status": "deleted"}
