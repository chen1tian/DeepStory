from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException
import structlog

from app.models.schemas import (
    Connection,
    ConnectionType,
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

log = structlog.get_logger()

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
        connection_type=req.connection_type,
        api_key=req.api_key,
        api_base_url=req.api_base_url,
        model_name=req.model_name,
        is_default=req.is_default,
        image_gen_config=req.image_gen_config,
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


@router.post("/connections/{cid}/test")
async def test_connection(cid: str):
    """Test a connection's API accessibility."""
    data = await load_connection(cid)
    if data is None:
        raise HTTPException(status_code=404, detail="Connection not found")

    connection_type = data.get("connection_type", "llm")

    if connection_type == ConnectionType.IMAGE_GENERATION:
        from app.services.image_gen_service import test_connection as test_image_gen
        result = await test_image_gen(data)
        return result
    elif connection_type == ConnectionType.LLM:
        # For LLM connections, test with a minimal chat completion request
        return await _test_llm_connection(data)
    else:
        return {"success": False, "message": f"不支持的连接类型: {connection_type}"}


async def _test_llm_connection(data: dict) -> dict:
    """Test LLM connection with a minimal API call."""
    import httpx

    api_key = data.get("api_key", "")
    api_base_url = data.get("api_base_url", "").rstrip("/")
    model_name = data.get("model_name", "")

    if not api_key:
        return {"success": False, "message": "API Key 不能为空"}
    if not api_base_url:
        return {"success": False, "message": "API Base URL 不能为空"}

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            url = f"{api_base_url}/chat/completions"
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            }
            payload = {
                "model": model_name or "gpt-4o-mini",
                "messages": [{"role": "user", "content": "hi"}],
                "max_tokens": 5,
            }
            resp = await client.post(url, json=payload, headers=headers)

            if resp.status_code == 200:
                return {"success": True, "message": "LLM API 连接成功"}
            elif resp.status_code == 401 or resp.status_code == 403:
                return {"success": False, "message": f"认证失败 (HTTP {resp.status_code})"}
            else:
                error_msg = ""
                try:
                    body = resp.json()
                    error_msg = body.get("error", {}).get("message", "") or body.get("message", "")
                except Exception:
                    error_msg = resp.text[:200]
                return {"success": False, "message": f"HTTP {resp.status_code}: {error_msg[:100]}"}

    except httpx.TimeoutException:
        return {"success": False, "message": "连接超时，请检查 API Base URL"}
    except httpx.ConnectError:
        return {"success": False, "message": "无法连接服务器，请检查 API Base URL"}
    except Exception as e:
        log.error("llm_test_error", error=str(e))
        return {"success": False, "message": f"测试异常: {str(e)[:100]}"}
