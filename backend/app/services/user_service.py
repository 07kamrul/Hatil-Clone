from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.enums import AdminRole
from app.core.errors import ConflictError, NotFoundError, ValidationAppError
from app.core.security import hash_password
from app.models import AdminUser
from app.repositories.base import Repository
from app.schemas.auth import AdminUserCreate, AdminUserUpdate


class UserService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = Repository(db, AdminUser)

    def list(self) -> list[AdminUser]:
        return self.repo.list_all(AdminUser.id)

    def get(self, user_id: int) -> AdminUser:
        user = self.repo.get(user_id)
        if user is None:
            raise NotFoundError("User not found")
        return user

    def create(self, data: AdminUserCreate) -> AdminUser:
        email = data.email.lower()
        if self.repo.exists(email=email):
            raise ConflictError("A user with this email already exists")
        user = self.repo.add(AdminUser(email=email, full_name=data.full_name, role=data.role,
                                       is_active=data.is_active, password_hash=hash_password(data.password)))
        self.db.commit()
        return user

    def update(self, user_id: int, data: AdminUserUpdate, acting: AdminUser) -> AdminUser:
        user = self.get(user_id)
        values = data.model_dump(exclude_unset=True)
        demoting = values.get("role") == AdminRole.ADMIN or values.get("is_active") is False
        if demoting and user.role == AdminRole.SUPER_ADMIN:
            self._ensure_other_super_admin(user.id)
        if user.id == acting.id and values.get("is_active") is False:
            raise ValidationAppError("You cannot deactivate your own account")
        password = values.pop("password", None)
        if password:
            values["password_hash"] = hash_password(password)
        self.repo.update(user, values)
        self.db.commit()
        return user

    def delete(self, user_id: int, acting: AdminUser) -> None:
        user = self.get(user_id)
        if user.id == acting.id:
            raise ValidationAppError("You cannot delete your own account")
        if user.role == AdminRole.SUPER_ADMIN:
            self._ensure_other_super_admin(user.id)
        self.repo.delete(user)
        self.db.commit()

    def _ensure_other_super_admin(self, user_id: int) -> None:
        others = self.db.scalar(
            select(func.count(AdminUser.id)).where(
                AdminUser.role == AdminRole.SUPER_ADMIN, AdminUser.is_active.is_(True), AdminUser.id != user_id
            )
        )
        if not others:
            raise ValidationAppError("At least one active super admin must remain")
