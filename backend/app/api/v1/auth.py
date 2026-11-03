from fastapi import APIRouter, Request

from app.core.deps import CurrentAdmin, DbSession
from app.core.rate_limit import LOGIN_LIMIT, limiter
from app.schemas.auth import AdminUserOut, ChangePasswordRequest, LoginRequest, RefreshRequest, TokenPair
from app.schemas.common import Message
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenPair)
@limiter.limit(LOGIN_LIMIT)
def login(request: Request, body: LoginRequest, db: DbSession) -> TokenPair:
    return AuthService(db).login(body.email, body.password)


@router.post("/refresh", response_model=TokenPair)
@limiter.limit(LOGIN_LIMIT)
def refresh(request: Request, body: RefreshRequest, db: DbSession) -> TokenPair:
    return AuthService(db).refresh(body.refresh_token)


@router.post("/logout", response_model=Message)
def logout(body: RefreshRequest, db: DbSession) -> Message:
    AuthService(db).logout(body.refresh_token)
    return Message(detail="Logged out")


@router.get("/me", response_model=AdminUserOut)
def me(user: CurrentAdmin) -> AdminUserOut:
    return AdminUserOut.model_validate(user)


@router.post("/change-password", response_model=Message)
def change_password(body: ChangePasswordRequest, user: CurrentAdmin, db: DbSession) -> Message:
    AuthService(db).change_password(user, body.current_password, body.new_password)
    return Message(detail="Password changed; please sign in again")
