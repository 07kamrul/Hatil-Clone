import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
import jwt

from app.core.config import get_settings

ACCESS = "access"
REFRESH = "refresh"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def _encode(payload: dict[str, Any]) -> str:
    settings = get_settings()
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(user_id: int, role: str) -> str:
    now = datetime.now(UTC)
    exp = now + timedelta(minutes=get_settings().access_token_minutes)
    return _encode({"sub": str(user_id), "role": role, "type": ACCESS, "iat": now, "exp": exp})


def create_refresh_token(user_id: int) -> tuple[str, str, datetime]:
    """Returns (token, jti, expires_at)."""
    now = datetime.now(UTC)
    jti = secrets.token_hex(16)
    exp = now + timedelta(days=get_settings().refresh_token_days)
    token = _encode({"sub": str(user_id), "type": REFRESH, "jti": jti, "iat": now, "exp": exp})
    return token, jti, exp


def decode_token(token: str, expected_type: str) -> dict[str, Any]:
    settings = get_settings()
    payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    if payload.get("type") != expected_type:
        raise jwt.InvalidTokenError("Wrong token type")
    return payload


def hash_ip(ip: str | None) -> str | None:
    """Anonymised client identifier for analytics/abuse checks (never store raw IPs)."""
    if not ip:
        return None
    salt = get_settings().jwt_secret[:16]
    return hashlib.sha256(f"{salt}:{ip}".encode()).hexdigest()
