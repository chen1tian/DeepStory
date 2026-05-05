from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException

from app.models.schemas import CreateSessionRequest, SessionResponse, SessionMeta, Message, UpdateSystemPromptRequest, SessionCharacter
from app.storage.file_storage import (
    generate_id,
    write_json,
    read_json,
    list_sessions,
    delete_session,
)
from app.storage.story_storage import load_story
from app.storage.protagonist_storage import load_protagonist
from app.storage.user_protagonist_storage import load_user_protagonist, list_user_protagonists
from app.storage.preset_storage import load_preset, list_presets
from app.services.chat_manager import create_branch_from

router = APIRouter(tags=["sessions"])


async def _get_default_preset() -> tuple[str | None, str]:
    """Find the default preset and return (id, content)."""
    presets = await list_presets()
    for p in presets:
        if p.get("is_default") and p.get("content"):
            return p.get("id"), p["content"]
    return None, ""


@router.post("/sessions", response_model=SessionResponse)
async def create_session(req: CreateSessionRequest):
    session_id = generate_id()
    now = datetime.now().isoformat()

    system_prompt = req.system_prompt
    opener_content: str | None = None
    story_title: str | None = None

    # 1. Resolve preset: explicit > default
    if req.preset_id:
        preset_data = await load_preset(req.preset_id)
        if preset_data:
            active_preset_id = req.preset_id
            preset_content = preset_data.get("content", "")
        else:
            active_preset_id, preset_content = await _get_default_preset()
    else:
        active_preset_id, preset_content = await _get_default_preset()
    if not system_prompt:
        system_prompt = preset_content

    # 2. If story_id provided, append story background
    if req.story_id:
        story_data = await load_story(req.story_id)
        if story_data:
            story_bg = story_data.get("background", "")
            if story_bg:
                # Preset as base + story background appended
                if preset_content and system_prompt == preset_content:
                    system_prompt = preset_content + "\n\n【故事背景】\n" + story_bg
                else:
                    system_prompt = story_bg
            story_title = story_data.get("title", "")
            openers = story_data.get("openers", [])
            idx = max(0, min(req.opener_index, len(openers) - 1)) if openers else -1
            if idx >= 0 and openers:
                opener_content = openers[idx].get("content", "")
            # Use story's bound user protagonist if none explicitly provided
            if not req.user_protagonist_id and story_data.get("protagonist_id"):
                req.user_protagonist_id = story_data["protagonist_id"]

            preset_character_lines: list[str] = []
            for character_id in story_data.get("preset_characters", []):
                if not isinstance(character_id, str) or not character_id:
                    continue
                protagonist = await load_protagonist(character_id)
                if not protagonist:
                    continue
                line = f"- {protagonist.get('name', '未命名角色')}"
                setting = protagonist.get("setting", "")
                if setting:
                    line += f": {setting}"
                preset_character_lines.append(line)

            if preset_character_lines:
                preset_character_block = (
                    "【预设角色】以下角色引用自角色池，请沿用其设定与身份信息：\n"
                    + "\n".join(preset_character_lines)
                )
                system_prompt = (
                    f"{system_prompt}\n\n{preset_character_block}"
                    if system_prompt
                    else preset_character_block
                )

    # Resolve the user protagonist for this session
    user_protagonist_id: str | None = None
    if req.user_protagonist_id:
        updata = await load_user_protagonist(req.user_protagonist_id)
        if updata:
            user_protagonist_id = req.user_protagonist_id
    if not user_protagonist_id:
        # Fallback to default user protagonist
        all_user_protagonists = await list_user_protagonists()
        for up in all_user_protagonists:
            if up.get("is_default"):
                user_protagonist_id = up["id"]
                break

    title = req.title
    if title == "新的对话" and story_title:
        title = story_title

    # Load cast from story into session characters
    initial_characters: list[SessionCharacter] = []
    if req.story_id:
        cast_story = await load_story(req.story_id)
        cast_ids = (cast_story or {}).get("cast_ids", [])
        for cid in cast_ids:
            pdata = await load_protagonist(cid)
            if pdata:
                initial_characters.append(SessionCharacter(
                    id=str(uuid.uuid4()),
                    pool_id=cid,
                    name=pdata.get("name", "未命名角色"),
                    setting=pdata.get("setting", ""),
                    avatar_emoji=pdata.get("avatar_emoji", "🧑"),
                    avatar_url=pdata.get("avatar_url"),
                    created_at=now,
                    updated_at=now,
                ))

    session = SessionMeta(
        id=session_id,
        title=title,
        created_at=now,
        updated_at=now,
        system_prompt=system_prompt,
        active_branch=[],
        preset_id=active_preset_id,
        characters=initial_characters,
        user_protagonist_id=user_protagonist_id,
        active_setting_ids=req.active_setting_ids,
    )
    await write_json(session_id, "session.json", session.model_dump())

    # Seed messages: add selected opener as first assistant message
    messages: list[dict] = []
    if opener_content:
        opener_msg = Message(
            id=generate_id(),
            parent_id=None,
            role="assistant",
            content=opener_content,
            timestamp=now,
            token_count=0,
            branch_id="main",
        )
        messages.append(opener_msg.model_dump())
        session.active_branch = [opener_msg.id]
        await write_json(session_id, "session.json", session.model_dump())

    await write_json(session_id, "messages.json", messages)
    return SessionResponse(
        id=session.id,
        title=session.title,
        created_at=session.created_at,
        updated_at=session.updated_at,
        preset_id=session.preset_id,
        characters=session.characters,
        user_protagonist_id=session.user_protagonist_id,
        active_setting_ids=session.active_setting_ids,
    )


@router.get("/sessions", response_model=list[SessionResponse])
async def get_sessions():
    sessions = await list_sessions()
    return [
        SessionResponse(
            id=s["id"],
            title=s.get("title", ""),
            created_at=s.get("created_at", ""),
            updated_at=s.get("updated_at", ""),
            preset_id=s.get("preset_id"),
            characters=s.get("characters", []),
            user_protagonist_id=s.get("user_protagonist_id"),
            active_setting_ids=s.get("active_setting_ids", []),
        )
        for s in sessions
    ]


@router.get("/sessions/{session_id}", response_model=SessionResponse)
async def get_session(session_id: str):
    data = await read_json(session_id, "session.json")
    if data is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return SessionResponse(
        id=data["id"],
        title=data.get("title", ""),
        created_at=data.get("created_at", ""),
        updated_at=data.get("updated_at", ""),
        preset_id=data.get("preset_id"),
        characters=data.get("characters", []),
        user_protagonist_id=data.get("user_protagonist_id"),
        active_setting_ids=data.get("active_setting_ids", []),
    )


@router.delete("/sessions/{session_id}")
async def remove_session(session_id: str):
    deleted = await delete_session(session_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "deleted"}


@router.put("/sessions/{session_id}/system-prompt")
async def update_system_prompt(session_id: str, req: UpdateSystemPromptRequest):
    data = await read_json(session_id, "session.json")
    if data is None:
        raise HTTPException(status_code=404, detail="Session not found")

    if req.preset_id:
        preset_data = await load_preset(req.preset_id)
        if preset_data is None:
            raise HTTPException(status_code=404, detail="Preset not found")
        new_prompt = preset_data.get("content", "")
        data["system_prompt"] = new_prompt
        data["preset_id"] = req.preset_id
    elif req.system_prompt is not None:
        data["system_prompt"] = req.system_prompt
    else:
        raise HTTPException(status_code=400, detail="Provide system_prompt or preset_id")

    data["updated_at"] = datetime.now().isoformat()
    await write_json(session_id, "session.json", data)
    return {"status": "updated", "system_prompt": data["system_prompt"]}


@router.post("/sessions/{session_id}/branch")
async def branch_from_message(session_id: str, message_id: str):
    try:
        new_branch = await create_branch_from(session_id, message_id)
        return {"active_branch": new_branch}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/sessions/{session_id}/protagonist")
async def set_session_protagonist(session_id: str, body: dict):
    """Switch the user protagonist bound to a session. Body: {"user_protagonist_id": "..."}""" 
    data = await read_json(session_id, "session.json")
    if data is None:
        raise HTTPException(status_code=404, detail="Session not found")
    uid = body.get("user_protagonist_id")
    if uid is not None:
        updata = await load_user_protagonist(uid)
        if updata is None:
            raise HTTPException(status_code=404, detail="User protagonist not found")
    data["user_protagonist_id"] = uid
    data["updated_at"] = datetime.now().isoformat()
    await write_json(session_id, "session.json", data)
    return {"status": "updated", "user_protagonist_id": uid}
