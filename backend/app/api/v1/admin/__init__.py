from fastapi import APIRouter, Depends

from app.api.v1.admin import catalog, content, dashboard, imports, inbox, maps, products, settings, uploads, users
from app.core.cache import response_cache
from app.core.deps import get_current_admin
from app.schemas.common import Message

router = APIRouter(prefix="/admin", dependencies=[Depends(get_current_admin)])
for module in (dashboard, products, catalog, content, inbox, imports, maps, settings, uploads, users):
    router.include_router(module.router)


@router.post("/cache/clear", response_model=Message, tags=["system"])
def clear_cache() -> Message:
    """Drop all cached public API responses (e.g. after an out-of-process import)."""
    dropped = response_cache.clear()
    return Message(detail=f"Cache cleared ({dropped} entries)")
