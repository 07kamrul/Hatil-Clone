from fastapi import APIRouter

from app.core.deps import DbSession
from app.schemas.system import DashboardStats
from app.services.dashboard_service import DashboardService

router = APIRouter(prefix="/dashboard", tags=["admin: dashboard"])


@router.get("", response_model=DashboardStats)
def stats(db: DbSession) -> DashboardStats:
    return DashboardService(db).stats()
