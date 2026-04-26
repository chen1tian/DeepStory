from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException

from app.models.schemas import (
    ChatHook,
    CreateHookRequest,
    UpdateHookRequest,
)
from app.storage.hook_storage import (
    save_hook,
    load_hook,
    list_hooks,
    delete_hook_file,
)

router = APIRouter(tags=["hooks"])


@router.post("/hooks", response_model=ChatHook)
async def create_hook(req: CreateHookRequest):
    hid = str(uuid.uuid4())
    now = datetime.now().isoformat()

    # Auto-generate response_key from last 8 chars of id if not provided
    response_key = req.response_key or f"hook_{hid[:8]}"

    h = ChatHook(
        id=hid,
        name=req.name,
        enabled=req.enabled,
        trigger=req.trigger,
        context_messages=req.context_messages,
        include_state=req.include_state,
        prompt=req.prompt,
        response_key=response_key,
        response_schema=req.response_schema,
        action=req.action,
        connection_id=req.connection_id,
        agent_mode=req.agent_mode,
        agent_tools=req.agent_tools,
        after_hook_callback=req.after_hook_callback,
        created_at=now,
        updated_at=now,
    )
    await save_hook(hid, h.model_dump())
    return h


@router.get("/hooks", response_model=list[ChatHook])
async def get_hooks():
    raw = await list_hooks()
    return [ChatHook(**d) for d in raw]


@router.get("/hooks/{hid}", response_model=ChatHook)
async def get_hook(hid: str):
    data = await load_hook(hid)
    if data is None:
        raise HTTPException(status_code=404, detail="Hook not found")
    return ChatHook(**data)


@router.put("/hooks/{hid}", response_model=ChatHook)
async def update_hook(hid: str, req: UpdateHookRequest):
    data = await load_hook(hid)
    if data is None:
        raise HTTPException(status_code=404, detail="Hook not found")

    updates = req.model_dump(exclude_none=True)
    # Handle nested action model
    if "action" in updates and isinstance(updates["action"], dict):
        # merge with existing action rather than replace outright
        existing_action = data.get("action", {})
        existing_action.update(updates["action"])
        updates["action"] = existing_action

    data.update(updates)
    data["updated_at"] = datetime.now().isoformat()
    await save_hook(hid, data)
    return ChatHook(**data)


@router.delete("/hooks/{hid}")
async def delete_hook(hid: str):
    ok = await delete_hook_file(hid)
    if not ok:
        raise HTTPException(status_code=404, detail="Hook not found")
    return {"status": "deleted"}
