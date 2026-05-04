"""Session character routes.

Each session maintains its own character list (copies of pool characters).
Characters in the pool are managed via /protagonists. Characters in a session
are managed here, with bidirectional sync helpers (push-to-pool / pull-from-pool).
"""
from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException

from app.models.schemas import (
    SessionCharacter,
    CreateSessionCharacterRequest,
    UpdateSessionCharacterRequest,
    Protagonist,
)
from app.storage.file_storage import read_json, write_json
from app.storage.protagonist_storage import (
    load_protagonist,
    save_protagonist,
    clear_default_flag,
)

router = APIRouter(tags=["characters"])


async def _load_session_data(session_id: str) -> dict:
    data = await read_json(session_id, "session.json")
    if data is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return data


async def _save_characters(session_id: str, session_data: dict, characters: list[dict]):
    session_data["characters"] = characters
    session_data["updated_at"] = datetime.now().isoformat()
    await write_json(session_id, "session.json", session_data)


# ─── CRUD ───────────────────────────────────────────────────────────────────

@router.get("/sessions/{session_id}/characters", response_model=list[SessionCharacter])
async def get_session_characters(session_id: str):
    data = await _load_session_data(session_id)
    return [SessionCharacter(**c) for c in data.get("characters", [])]


@router.post("/sessions/{session_id}/characters", response_model=SessionCharacter)
async def add_session_character(session_id: str, req: CreateSessionCharacterRequest):
    data = await _load_session_data(session_id)
    now = datetime.now().isoformat()

    # If pool_id given, copy from protagonist pool
    if req.pool_id:
        pool_data = await load_protagonist(req.pool_id)
        if pool_data is None:
            raise HTTPException(status_code=404, detail="Protagonist not found in pool")
        char = SessionCharacter(
            id=str(uuid.uuid4()),
            pool_id=req.pool_id,
            name=pool_data.get("name", req.name),
            setting=pool_data.get("setting", req.setting),
            avatar_emoji=pool_data.get("avatar_emoji", req.avatar_emoji),
            avatar_url=pool_data.get("avatar_url", req.avatar_url),
            relationship_metrics=pool_data.get("relationship_metrics", req.relationship_metrics),
            created_at=now,
            updated_at=now,
        )
    else:
        char = SessionCharacter(
            id=str(uuid.uuid4()),
            pool_id=None,
            name=req.name,
            setting=req.setting,
            avatar_emoji=req.avatar_emoji,
            avatar_url=req.avatar_url,
            relationship_metrics=req.relationship_metrics,
            created_at=now,
            updated_at=now,
        )

    characters = data.get("characters", [])
    characters.append(char.model_dump())
    await _save_characters(session_id, data, characters)
    return char


@router.put("/sessions/{session_id}/characters/{char_id}", response_model=SessionCharacter)
async def update_session_character(
    session_id: str, char_id: str, req: UpdateSessionCharacterRequest
):
    data = await _load_session_data(session_id)
    characters = data.get("characters", [])
    idx = next((i for i, c in enumerate(characters) if c["id"] == char_id), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="Character not found in session")

    updates = req.model_dump(exclude_none=True)
    characters[idx].update(updates)
    characters[idx]["updated_at"] = datetime.now().isoformat()
    await _save_characters(session_id, data, characters)
    return SessionCharacter(**characters[idx])


@router.delete("/sessions/{session_id}/characters/{char_id}")
async def delete_session_character(session_id: str, char_id: str):
    data = await _load_session_data(session_id)
    characters = data.get("characters", [])
    new_chars = [c for c in characters if c["id"] != char_id]
    if len(new_chars) == len(characters):
        raise HTTPException(status_code=404, detail="Character not found in session")
    await _save_characters(session_id, data, new_chars)
    return {"status": "deleted"}


# ─── COPY ────────────────────────────────────────────────────────────────────

@router.post("/sessions/{session_id}/characters/{char_id}/copy", response_model=SessionCharacter)
async def copy_session_character(session_id: str, char_id: str, body: dict):
    """Copy a session character. Body: {"name": "new name"}"""
    new_name: str = body.get("name", "")
    if not new_name:
        raise HTTPException(status_code=422, detail="name is required")

    data = await _load_session_data(session_id)
    characters = data.get("characters", [])
    src = next((c for c in characters if c["id"] == char_id), None)
    if src is None:
        raise HTTPException(status_code=404, detail="Character not found in session")

    now = datetime.now().isoformat()
    new_char = SessionCharacter(
        id=str(uuid.uuid4()),
        pool_id=None,  # copy is standalone, no pool link
        name=new_name,
        setting=src.get("setting", ""),
        avatar_emoji=src.get("avatar_emoji", "🧑"),
        avatar_url=src.get("avatar_url"),
        relationship_metrics=src.get("relationship_metrics", []),
        created_at=now,
        updated_at=now,
    )
    characters.append(new_char.model_dump())
    await _save_characters(session_id, data, characters)
    return new_char


# ─── POOL SYNC ───────────────────────────────────────────────────────────────

@router.post(
    "/sessions/{session_id}/characters/{char_id}/push-to-pool",
    response_model=Protagonist,
)
async def push_character_to_pool(session_id: str, char_id: str):
    """Push session character data to the protagonist pool.

    - If the character has a pool_id, update that protagonist in place.
    - Otherwise, create a new protagonist and back-link pool_id.
    """
    data = await _load_session_data(session_id)
    characters = data.get("characters", [])
    idx = next((i for i, c in enumerate(characters) if c["id"] == char_id), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="Character not found in session")

    char = characters[idx]
    now = datetime.now().isoformat()

    pool_id = char.get("pool_id")
    if pool_id:
        # Update existing protagonist
        pool_data = await load_protagonist(pool_id)
        if pool_data is None:
            # Pool entry was deleted; create a new one
            pool_id = None
        else:
            pool_data["name"] = char["name"]
            pool_data["setting"] = char.get("setting", "")
            pool_data["avatar_emoji"] = char.get("avatar_emoji", "🧑")
            pool_data["avatar_url"] = char.get("avatar_url")
            pool_data["relationship_metrics"] = char.get("relationship_metrics", [])
            pool_data["updated_at"] = now
            await save_protagonist(pool_id, pool_data)
            protagonist = Protagonist(**pool_data)
            return protagonist

    # Create new protagonist
    pool_id = str(uuid.uuid4())
    protagonist = Protagonist(
        id=pool_id,
        name=char["name"],
        setting=char.get("setting", ""),
        avatar_emoji=char.get("avatar_emoji", "🧑"),
        avatar_url=char.get("avatar_url"),
        relationship_metrics=char.get("relationship_metrics", []),
        is_default=False,
        created_at=now,
        updated_at=now,
    )
    await save_protagonist(pool_id, protagonist.model_dump())

    # Back-link pool_id to session character
    characters[idx]["pool_id"] = pool_id
    characters[idx]["updated_at"] = now
    await _save_characters(session_id, data, characters)
    return protagonist


@router.post(
    "/sessions/{session_id}/characters/{char_id}/pull-from-pool",
    response_model=SessionCharacter,
)
async def pull_character_from_pool(session_id: str, char_id: str):
    """Overwrite session character with current data from its pool_id source."""
    data = await _load_session_data(session_id)
    characters = data.get("characters", [])
    idx = next((i for i, c in enumerate(characters) if c["id"] == char_id), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="Character not found in session")

    pool_id = characters[idx].get("pool_id")
    if not pool_id:
        raise HTTPException(
            status_code=422, detail="Character is not linked to a pool entry"
        )

    pool_data = await load_protagonist(pool_id)
    if pool_data is None:
        raise HTTPException(status_code=404, detail="Pool protagonist not found")

    now = datetime.now().isoformat()
    characters[idx]["name"] = pool_data["name"]
    characters[idx]["setting"] = pool_data.get("setting", "")
    characters[idx]["avatar_emoji"] = pool_data.get("avatar_emoji", "🧑")
    characters[idx]["avatar_url"] = pool_data.get("avatar_url")
    characters[idx]["relationship_metrics"] = pool_data.get("relationship_metrics", [])
    characters[idx]["updated_at"] = now
    await _save_characters(session_id, data, characters)
    return SessionCharacter(**characters[idx])
