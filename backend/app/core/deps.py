from typing import Annotated

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.enums import AdminRole
from app.core.errors import AuthError, ForbiddenError
from app.core.security import ACCESS, decode_token
from app.db.session import get_db
from app.models import AdminUser

DbSession = Annotated[Session, Depends(get_db)]
_bearer = HTTPBearer(auto_error=False)


def get_current_admin(
    db: DbSession, credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)]
) -> AdminUser:
    if credentials is None:
        raise AuthError("Not authenticated")
    try:
        payload = decode_token(credentials.credentials, ACCESS)
    except jwt.PyJWTError as exc:
        raise AuthError("Invalid or expired token") from exc
    user = db.get(AdminUser, int(payload["sub"]))
    if user is None or not user.is_active:
        raise AuthError("Account disabled or not found")
    return user


CurrentAdmin = Annotated[AdminUser, Depends(get_current_admin)]


def require_super_admin(user: CurrentAdmin) -> AdminUser:
    if user.role != AdminRole.SUPER_ADMIN:
        raise ForbiddenError("Super admin privileges required")
    return user


SuperAdmin = Annotated[AdminUser, Depends(require_super_admin)]
