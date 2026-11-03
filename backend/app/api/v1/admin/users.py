from fastapi import APIRouter, status

from app.core.deps import DbSession, SuperAdmin
from app.schemas.auth import AdminUserCreate, AdminUserOut, AdminUserUpdate
from app.schemas.common import Message
from app.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["admin: users"])


@router.get("", response_model=list[AdminUserOut])
def list_users(_: SuperAdmin, db: DbSession) -> list[AdminUserOut]:
    return [AdminUserOut.model_validate(u) for u in UserService(db).list()]


@router.post("", response_model=AdminUserOut, status_code=status.HTTP_201_CREATED)
def create_user(body: AdminUserCreate, _: SuperAdmin, db: DbSession) -> AdminUserOut:
    return AdminUserOut.model_validate(UserService(db).create(body))


@router.patch("/{user_id}", response_model=AdminUserOut)
def update_user(user_id: int, body: AdminUserUpdate, acting: SuperAdmin, db: DbSession) -> AdminUserOut:
    return AdminUserOut.model_validate(UserService(db).update(user_id, body, acting))


@router.delete("/{user_id}", response_model=Message)
def delete_user(user_id: int, acting: SuperAdmin, db: DbSession) -> Message:
    UserService(db).delete(user_id, acting)
    return Message(detail="User deleted")
