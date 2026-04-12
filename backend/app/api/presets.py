from __future__ import annotations

import asyncio
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
from app.storage.file_storage import list_sessions, read_json, write_json

router = APIRouter(tags=["presets"])


async def _apply_default_preset_to_unlinked(pid: str, content: str) -> None:
    """将默认预设应用到尚未关联任何预设的 session。
    - 若 system_prompt 为空：直接设置为预设内容
    - 若 system_prompt 有内容（如故事背景）：将预设内容前置拼接，保留原有内容
    """
    now = datetime.now().isoformat()
    sessions = await list_sessions()

    async def _set(session: dict) -> None:
        # 已关联了某个预设（非空、非 None），跳过
        if session.get("preset_id"):
            return
        sid = session["id"]
        session_data = await read_json(sid, "session.json")
        if session_data is None:
            return
        existing = session_data.get("system_prompt", "") or ""
        if existing:
            # 前置拼接：预设 + 原有内容（故事背景等）
            session_data["system_prompt"] = content + "\n\n" + existing
        else:
            session_data["system_prompt"] = content
        session_data["preset_id"] = pid
        session_data["updated_at"] = now
        await write_json(sid, "session.json", session_data)

    await asyncio.gather(*[_set(s) for s in sessions])


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

    # 新建即为默认且有内容时，注入到无预设的 session
    if req.is_default and req.content:
        await _apply_default_preset_to_unlinked(pid, req.content)

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
    content_changed = "content" in updates and updates["content"] != data.get("content")

    if updates.get("is_default"):
        await clear_default_flag()

    data.update(updates)
    data["updated_at"] = datetime.now().isoformat()
    await save_preset(pid, data)

    # Hot-reload: sync system_prompt in all sessions that use this preset
    if content_changed:
        new_content = data["content"]
        now = datetime.now().isoformat()
        sessions = await list_sessions()

        async def _sync_session(session: dict) -> None:
            if session.get("preset_id") != pid:
                return
            sid = session["id"]
            session_data = await read_json(sid, "session.json")
            if session_data is None:
                return
            session_data["system_prompt"] = new_content
            session_data["updated_at"] = now
            await write_json(sid, "session.json", session_data)

        await asyncio.gather(*[_sync_session(s) for s in sessions])

    # 设置为默认时，将预设注入到尚未关联任何预设且提示词为空的 session
    if updates.get("is_default") and data.get("content"):
        await _apply_default_preset_to_unlinked(pid, data["content"])

    return Preset(**data)


@router.delete("/presets/{pid}")
async def delete_preset(pid: str):
    ok = await delete_preset_file(pid)
    if not ok:
        raise HTTPException(status_code=404, detail="Preset not found")
    return {"status": "deleted"}
