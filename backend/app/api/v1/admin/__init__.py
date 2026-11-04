from fastapi import APIRouter, Depends

from app.api.v1.admin import catalog, content, dashboard, imports, inbox, products, settings, uploads, users
from app.core.deps import get_current_admin

router = APIRouter(prefix="/admin", dependencies=[Depends(get_current_admin)])
for module in (dashboard, products, catalog, content, inbox, imports, settings, uploads, users):
    router.include_router(module.router)
