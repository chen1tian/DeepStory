from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException

from app.models.schemas import (
    Connection,
    CreateConnectionRequest,
    UpdateConnectionRequest,
)

from app.storage.connection_storage import (
    save_connection,
    load_connection,
    list_connections,
    delete_connection_file,
    clear_default_flag,
)

router = APIRouter(tags=["connections"])


@router.post("/connections", response_model=Connection)
async def create_connection(req: CreateConnectionRequest):
    cid = str(uuid.uuid4())
    now = datetime.now().isoformat()

    if req.is_default:
        await clear_default_flag()

    c = Connection(
        id=cid,
        name=req.name,
        api_key=req.api_key,
        api_base_url=req.api_base_url,
        model_name=req.model_name,
        is_default=req.is_default,
        created_at=now,
        updated_at=now,
    )
    await save_connection(cid, c.model_dump())
    return c


@router.get("/connections", response_model=list[Connection])
async def get_connections():
    return await list_connections()


@router.get("/connections/{cid}", response_model=Connection)
async def get_connection(cid: str):
    data = await load_connection(cid)
    if data is None:
        raise HTTPException(status_code=404, detail="Connection not found")
    return Connection(**data)


@router.put("/connections/{cid}", response_model=Connection)
async def update_connection(cid: str, req: UpdateConnectionRequest):
    data = await load_connection(cid)
    if data is None:
        raise HTTPException(status_code=404, detail="Connection not found")

    updates = req.model_dump(exclude_none=True)

    if updates.get("is_default"):
        await clear_default_flag()

    data.update(updates)
    data["updated_at"] = datetime.now().isoformat()
    await save_connection(cid, data)
    return Connection(**data)


@router.delete("/connections/{cid}")
async def delete_connection(cid: str):
    ok = await delete_connection_file(cid)
    if not ok:
        raise HTTPException(status_code=404, detail="Connection not found")
    return {"status": "deleted"}
