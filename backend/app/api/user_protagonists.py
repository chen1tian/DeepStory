from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException

from app.models.schemas import (
    UserProtagonist,
    CreateUserProtagonistRequest,
    UpdateUserProtagonistRequest,
)
from app.storage.user_protagonist_storage import (
    save_user_protagonist,
    load_user_protagonist,
    list_user_protagonists,
    delete_user_protagonist_file,
    clear_user_protagonist_default_flag,
)

router = APIRouter(tags=["user_protagonists"])


@router.post("/user-protagonists", response_model=UserProtagonist)
async def create_user_protagonist(req: CreateUserProtagonistRequest):
    pid = str(uuid.uuid4())
    now = datetime.now().isoformat()

    if req.is_default:
        await clear_user_protagonist_default_flag()

    p = UserProtagonist(
        id=pid,
        name=req.name,
        setting=req.setting,
        avatar_emoji=req.avatar_emoji,
        is_default=req.is_default,
        created_at=now,
        updated_at=now,
    )
    await save_user_protagonist(pid, p.model_dump())
    return p


@router.get("/user-protagonists", response_model=list[UserProtagonist])
async def get_user_protagonists():
    return await list_user_protagonists()


@router.get("/user-protagonists/{pid}", response_model=UserProtagonist)
async def get_user_protagonist(pid: str):
    data = await load_user_protagonist(pid)
    if data is None:
        raise HTTPException(status_code=404, detail="User protagonist not found")
    return UserProtagonist(**data)


@router.put("/user-protagonists/{pid}", response_model=UserProtagonist)
async def update_user_protagonist(pid: str, req: UpdateUserProtagonistRequest):
    data = await load_user_protagonist(pid)
    if data is None:
        raise HTTPException(status_code=404, detail="User protagonist not found")

    updates = req.model_dump(exclude_none=True)

    if updates.get("is_default"):
        await clear_user_protagonist_default_flag()

    data.update(updates)
    data["updated_at"] = datetime.now().isoformat()
    await save_user_protagonist(pid, data)
    return UserProtagonist(**data)


@router.delete("/user-protagonists/{pid}")
async def delete_user_protagonist(pid: str):
    ok = await delete_user_protagonist_file(pid)
    if not ok:
        raise HTTPException(status_code=404, detail="User protagonist not found")
    return {"status": "deleted"}


@router.post("/user-protagonists/{pid}/copy", response_model=UserProtagonist)
async def copy_user_protagonist(pid: str, body: dict):
    """Copy a user protagonist with a new name. Body: {"name": "new name"}"""
    new_name: str = body.get("name", "")
    if not new_name:
        raise HTTPException(status_code=422, detail="name is required")

    data = await load_user_protagonist(pid)
    if data is None:
        raise HTTPException(status_code=404, detail="User protagonist not found")

    now = datetime.now().isoformat()
    new_pid = str(uuid.uuid4())
    p = UserProtagonist(
        id=new_pid,
        name=new_name,
        setting=data.get("setting", ""),
        avatar_emoji=data.get("avatar_emoji", "🧑"),
        is_default=False,
        created_at=now,
        updated_at=now,
    )
    await save_user_protagonist(new_pid, p.model_dump())
    return p
