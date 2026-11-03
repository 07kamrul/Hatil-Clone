import logging
from datetime import UTC, datetime

import jwt
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AuthError, ValidationAppError
from app.core.security import (
    REFRESH,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models import AdminUser, RefreshToken
from app.repositories.base import Repository
from app.schemas.auth import TokenPair

log = logging.getLogger("app.auth")

# Pre-computed hash used to equalise timing when the email does not exist.
_DUMMY_HASH = hash_password("timing-equaliser-password")


class AuthService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.users = Repository(db, AdminUser)
        self.tokens = Repository(db, RefreshToken)

    def login(self, email: str, password: str) -> TokenPair:
        user = self.users.get_by(email=email.lower())
        if user is None:
            verify_password(password, _DUMMY_HASH)
            raise AuthError("Invalid email or password")
        if not verify_password(password, user.password_hash) or not user.is_active:
            log.warning("Failed login for user id=%s", user.id)
            raise AuthError("Invalid email or password")
        user.last_login_at = datetime.now(UTC)
        pair = self._issue(user)
        self.db.commit()
        return pair

    def refresh(self, refresh_token: str) -> TokenPair:
        try:
            payload = decode_token(refresh_token, REFRESH)
        except jwt.PyJWTError as exc:
            raise AuthError("Invalid or expired refresh token") from exc
        stored = self.tokens.get_by(jti=payload.get("jti"))
        if stored is None:
            raise AuthError("Invalid refresh token")
        if stored.revoked:
            # Reuse of a rotated token: assume theft and revoke every session of this user.
            self._revoke_all(stored.user_id)
            self.db.commit()
            log.warning("Refresh token reuse detected for user id=%s", stored.user_id)
            raise AuthError("Refresh token has been revoked")
        user = self.users.get(stored.user_id)
        if user is None or not user.is_active:
            raise AuthError("Account disabled or not found")
        stored.revoked = True
        pair = self._issue(user)
        self.db.commit()
        return pair

    def logout(self, refresh_token: str) -> None:
        try:
            payload = decode_token(refresh_token, REFRESH)
        except jwt.PyJWTError:
            return
        stored = self.tokens.get_by(jti=payload.get("jti"))
        if stored is not None:
            stored.revoked = True
            self.db.commit()

    def change_password(self, user: AdminUser, current: str, new: str) -> None:
        if not verify_password(current, user.password_hash):
            raise ValidationAppError("Current password is incorrect")
        user.password_hash = hash_password(new)
        self._revoke_all(user.id)
        self.db.commit()

    def _issue(self, user: AdminUser) -> TokenPair:
        access = create_access_token(user.id, user.role.value)
        refresh, jti, expires_at = create_refresh_token(user.id)
        self.tokens.add(RefreshToken(jti=jti, user_id=user.id, expires_at=expires_at))
        return TokenPair(access_token=access, refresh_token=refresh,
                         expires_in=get_settings().access_token_minutes * 60)

    def _revoke_all(self, user_id: int) -> None:
        self.db.execute(update(RefreshToken).where(RefreshToken.user_id == user_id).values(revoked=True))
