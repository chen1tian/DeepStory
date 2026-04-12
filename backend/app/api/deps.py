from __future__ import annotations

from fastapi import Header, HTTPException, status

from app.services.auth_service import decode_access_token
from app.storage.base import set_user_id
from app.storage.user_storage import get_user_by_id


async def get_current_user(authorization: str | None = Header(default=None)) -> dict:
    """FastAPI dependency: validates Bearer token, sets user context, returns user dict."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization.removeprefix("Bearer ").strip()
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id: str = payload.get("sub", "")
    user = await get_user_by_id(user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    set_user_id(user["id"])
    return user
