from __future__ import annotations

from contextvars import ContextVar
from pathlib import Path

from app.config import settings

# Per-request user context (asyncio-safe)
_current_user_id: ContextVar[str | None] = ContextVar("current_user_id", default=None)


def set_user_id(user_id: str) -> None:
    """Set the current user ID for the active request context."""
    _current_user_id.set(user_id)


def get_data_dir() -> Path:
    """Return the data directory for the current user, or the global data dir if no user context."""
    user_id = _current_user_id.get()
    if user_id:
        return settings.data_dir / "users" / user_id
    return settings.data_dir
