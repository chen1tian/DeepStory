from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException

from app.models.schemas import (
    Story,
    CreateStoryRequest,
    UpdateStoryRequest,
)
from app.storage.story_storage import (
    save_story,
    load_story,
    list_stories,
    delete_story_file,
)

router = APIRouter(tags=["stories"])


@router.post("/stories", response_model=Story)
async def create_story(req: CreateStoryRequest):
    story_id = str(uuid.uuid4())
    now = datetime.now().isoformat()
    story = Story(
        id=story_id,
        title=req.title,
        description=req.description,
        background=req.background,
        openers=req.openers,
        preset_characters=req.preset_characters,
        color=req.color,
        created_at=now,
        updated_at=now,
    )
    await save_story(story_id, story.model_dump())
    return story


@router.get("/stories", response_model=list[Story])
async def get_stories():
    return await list_stories()


@router.get("/stories/{story_id}", response_model=Story)
async def get_story(story_id: str):
    data = await load_story(story_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Story not found")
    return Story(**data)


@router.put("/stories/{story_id}", response_model=Story)
async def update_story(story_id: str, req: UpdateStoryRequest):
    data = await load_story(story_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Story not found")

    updates = req.model_dump(exclude_none=True)
    # Convert nested pydantic models to dicts
    if "openers" in updates:
        updates["openers"] = [o.model_dump() if hasattr(o, "model_dump") else o for o in updates["openers"]]
    if "preset_characters" in updates:
        updates["preset_characters"] = [c.model_dump() if hasattr(c, "model_dump") else c for c in updates["preset_characters"]]

    data.update(updates)
    data["updated_at"] = datetime.now().isoformat()
    await save_story(story_id, data)
    return Story(**data)


@router.delete("/stories/{story_id}")
async def delete_story(story_id: str):
    ok = await delete_story_file(story_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Story not found")
    return {"status": "deleted"}
