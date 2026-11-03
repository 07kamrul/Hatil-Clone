from typing import Any

from fastapi import APIRouter

from app.core.deps import DbSession
from app.schemas.system import SettingsUpdate
from app.services.settings_service import SettingsService

router = APIRouter(prefix="/settings", tags=["admin: settings"])


@router.get("", response_model=dict[str, Any])
def get_settings(db: DbSession) -> dict[str, Any]:
    return SettingsService(db).all()


@router.put("", response_model=dict[str, Any])
def update_settings(body: SettingsUpdate, db: DbSession) -> dict[str, Any]:
    return SettingsService(db).update(body.values)
