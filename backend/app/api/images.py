"""Image upload and serving API."""

from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, File
import structlog

from app.storage.base import get_data_dir

log = structlog.get_logger()

router = APIRouter(tags=["images"])

ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


def _images_dir() -> Path:
    return get_data_dir() / "images"


@router.post("/images/upload")
async def upload_image(file: UploadFile = File(...)):
    """Upload an image file. Returns the URL path to the uploaded image."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="文件名不能为空")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的文件格式: {ext}，支持: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="文件大小不能超过 10MB")

    # Save with UUID filename to avoid conflicts
    file_id = str(uuid.uuid4())
    filename = f"{file_id}{ext}"

    images_dir = _images_dir()
    images_dir.mkdir(parents=True, exist_ok=True)
    file_path = images_dir / filename
    file_path.write_bytes(content)

    log.info("image_uploaded", filename=filename, size=len(content))

    return {"url": f"/api/images/{filename}", "filename": filename}
