from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.core.enums import AdminRole
from app.schemas.common import ORMModel


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=10, max_length=2000)


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class AdminUserOut(ORMModel):
    id: int
    email: str
    full_name: str
    role: AdminRole
    is_active: bool
    last_login_at: datetime | None
    created_at: datetime


class AdminUserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field("", max_length=200)
    password: str = Field(min_length=8, max_length=200)
    role: AdminRole = AdminRole.ADMIN
    is_active: bool = True


class AdminUserUpdate(BaseModel):
    full_name: str | None = Field(None, max_length=200)
    password: str | None = Field(None, min_length=8, max_length=200)
    role: AdminRole | None = None
    is_active: bool | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=200)
