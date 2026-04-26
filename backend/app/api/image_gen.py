"""Image generation API endpoint."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import structlog

from app.services.image_gen_service import generate_image
from app.storage.connection_storage import load_connection, list_connections

log = structlog.get_logger()

router = APIRouter(tags=["image-gen"])


class GenerateImageRequest(BaseModel):
    prompt: str
    connection_id: str | None = None
    size: str = "1024x1024"
    n: int = 1


class GenerateImageResponse(BaseModel):
    success: bool
    message: str
    url: str | None = None


@router.post("/image-gen/generate", response_model=GenerateImageResponse)
async def generate_image_endpoint(req: GenerateImageRequest):
    """Generate an image using an image generation connection."""
    # Find the connection to use
    conn_data = None
    if req.connection_id:
        conn_data = await load_connection(req.connection_id)
        if conn_data and conn_data.get("connection_type") != "image_generation":
            conn_data = None

    if not conn_data:
        # Auto-select first available image_generation connection
        conns = await list_connections()
        img_conns = [c for c in conns if c.get("connection_type") == "image_generation"]
        if img_conns:
            # Prefer default
            conn_data = next((c for c in img_conns if c.get("is_default")), img_conns[0])

    if not conn_data:
        return GenerateImageResponse(
            success=False,
            message="未找到可用的文生图连接，请先在连接管理中创建文生图连接",
            url=None,
        )

    result = await generate_image(
        connection_data=conn_data,
        prompt=req.prompt,
        size=req.size,
        n=req.n,
    )
    return GenerateImageResponse(**result)
