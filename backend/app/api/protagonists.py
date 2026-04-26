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
        avatar_url=req.avatar_url,
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


@router.post("/protagonists/{pid}/copy", response_model=Protagonist)
async def copy_protagonist(pid: str, body: dict):
    """Copy a protagonist with a new name. Body: {"name": "new name"}"""
    new_name: str = body.get("name", "")
    if not new_name:
        raise HTTPException(status_code=422, detail="name is required")

    data = await load_protagonist(pid)
    if data is None:
        raise HTTPException(status_code=404, detail="Protagonist not found")

    now = datetime.now().isoformat()
    new_pid = str(uuid.uuid4())
    p = Protagonist(
        id=new_pid,
        name=new_name,
        setting=data.get("setting", ""),
        avatar_emoji=data.get("avatar_emoji", "🧑"),
        avatar_url=data.get("avatar_url"),
        is_default=False,
        created_at=now,
        updated_at=now,
    )
    await save_protagonist(new_pid, p.model_dump())
    return p


@router.post("/protagonists/from-rpg-character", response_model=Protagonist)
async def create_from_rpg_character(body: dict):
    """Create a protagonist from RPG character state data.

    Body: { name, description, health, max_health, energy, max_energy,
            mood, injuries, status_effects, equipment, skills, relationships, tags, ... }
    Converts RPG state into a compact setting text.
    """
    name: str = body.get("name", "")
    if not name:
        raise HTTPException(status_code=422, detail="name is required")

    # Build a setting string from RPG character fields
    parts = []
    desc = body.get("description", "")
    if desc:
        parts.append(desc)

    mood = body.get("mood", "")
    if mood:
        parts.append(f"情绪: {mood}")

    tags = body.get("tags", [])
    if tags:
        parts.append(f"标签: {', '.join(tags)}")

    relationships = body.get("relationships", [])
    if relationships:
        rel_strs = []
        for r in relationships:
            s = r.get("npc", "")
            if r.get("attitude"):
                s += f" ({r['attitude']})"
            if r.get("note"):
                s += f" - {r['note']}"
            rel_strs.append(s)
        parts.append("关系: " + "; ".join(rel_strs))

    skills = body.get("skills", [])
    if skills:
        sk_strs = [s.get("name", "") for s in skills if s.get("name")]
        if sk_strs:
            parts.append(f"技能: {', '.join(sk_strs)}")

    equipment = body.get("equipment", [])
    if equipment:
        eq_strs = [e.get("name", "") for e in equipment if e.get("name")]
        if eq_strs:
            parts.append(f"装备: {', '.join(eq_strs)}")

    setting = "\n".join(parts)

    now = datetime.now().isoformat()
    pid = str(uuid.uuid4())
    p = Protagonist(
        id=pid,
        name=name,
        setting=setting,
        avatar_emoji="🧑",
        is_default=False,
        created_at=now,
        updated_at=now,
    )
    await save_protagonist(pid, p.model_dump())
    return p
