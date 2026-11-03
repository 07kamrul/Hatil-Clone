"""Factory for admin CRUD routers of simple entities (routers → CrudService → Repository)."""

from typing import Any

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel

from app.core.deps import DbSession
from app.db.base import Base
from app.schemas.common import Message, Page, PageParams, SortOrderItem
from app.services.crud_service import CrudConfig, CrudService


def build_crud_router(
    prefix: str, tag: str, model: type[Base], config: CrudConfig,
    create_schema: type[BaseModel], update_schema: type[BaseModel], out_schema: type[BaseModel],
) -> APIRouter:
    router = APIRouter(prefix=prefix, tags=[tag])

    def service(db: DbSession) -> CrudService:
        return CrudService(db, model, config)

    @router.get("", response_model=Page[out_schema])  # type: ignore[valid-type]
    def list_items(
        params: PageParams = Depends(),
        q: str | None = Query(None, max_length=100),
        svc: CrudService = Depends(service),
    ) -> Any:
        items, total = svc.list(params, q)
        return Page[out_schema].build([out_schema.model_validate(i) for i in items], total, params)  # type: ignore[valid-type]

    @router.get("/{item_id}", response_model=out_schema)
    def get_item(item_id: int, svc: CrudService = Depends(service)) -> Any:
        return out_schema.model_validate(svc.get(item_id))

    @router.post("", response_model=out_schema, status_code=status.HTTP_201_CREATED)
    def create_item(body: create_schema, svc: CrudService = Depends(service)) -> Any:  # type: ignore[valid-type]
        return out_schema.model_validate(svc.create(body))

    @router.patch("/{item_id}", response_model=out_schema)
    def update_item(item_id: int, body: update_schema, svc: CrudService = Depends(service)) -> Any:  # type: ignore[valid-type]
        return out_schema.model_validate(svc.update(item_id, body))

    @router.delete("/{item_id}", response_model=Message)
    def delete_item(item_id: int, svc: CrudService = Depends(service)) -> Message:
        svc.delete(item_id)
        return Message(detail=f"{config.label} deleted")

    if hasattr(model, "sort_order"):
        @router.put("/reorder", response_model=Message)
        def reorder(items: list[SortOrderItem], svc: CrudService = Depends(service)) -> Message:
            svc.reorder(items)
            return Message(detail="Order saved")

        # Make sure "/reorder" is matched before "/{item_id}".
        router.routes.insert(0, router.routes.pop())

    return router
