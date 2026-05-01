from __future__ import annotations

from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt

from app.config import settings

_BCRYPT_MAX_LENGTH = 72


def _truncate_password(plain: str) -> bytes:
    encoded = plain.encode("utf-8")
    if len(encoded) <= _BCRYPT_MAX_LENGTH:
        return encoded
    return encoded[:_BCRYPT_MAX_LENGTH]


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(_truncate_password(plain), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(_truncate_password(plain), hashed.encode("utf-8"))


def create_access_token(user_id: str, username: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": user_id, "username": username, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        return payload
    except JWTError:
        return None
