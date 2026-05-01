from __future__ import annotations

from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


_BCRYPT_MAX_LENGTH = 72


def _truncate_password(plain: str) -> str:
    encoded = plain.encode("utf-8")
    if len(encoded) <= _BCRYPT_MAX_LENGTH:
        return plain
    return encoded[:_BCRYPT_MAX_LENGTH].decode("utf-8", errors="ignore")


def hash_password(plain: str) -> str:
    return _pwd_context.hash(_truncate_password(plain))


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd_context.verify(_truncate_password(plain), hashed)


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
