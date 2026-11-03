from fastapi import APIRouter, status

from app.api.v1.admin.crud import build_crud_router
from app.core.deps import DbSession
from app.models import Color, Material, Room
from app.schemas.catalog import (
    CategoryIn,
    CategoryNode,
    CategoryOut,
    CategoryUpdate,
    ColorIn,
    ColorOut,
    ColorUpdate,
    MaterialIn,
    MaterialOut,
    MaterialUpdate,
    RoomIn,
    RoomOut,
    RoomUpdate,
)
from app.schemas.common import Message
from app.services.category_service import CategoryService
from app.services.crud_service import CrudConfig

router = APIRouter()

categories = APIRouter(prefix="/categories", tags=["admin: categories"])


@categories.get("/tree", response_model=list[CategoryNode])
def category_tree(db: DbSession) -> list[CategoryNode]:
    return CategoryService(db).tree(active_only=False)


@categories.get("", response_model=list[CategoryOut])
def list_categories(db: DbSession) -> list[CategoryOut]:
    return [CategoryOut.model_validate(c) for c in CategoryService(db).list_flat()]


@categories.get("/{category_id}", response_model=CategoryOut)
def get_category(category_id: int, db: DbSession) -> CategoryOut:
    return CategoryOut.model_validate(CategoryService(db).get(category_id))


@categories.post("", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(body: CategoryIn, db: DbSession) -> CategoryOut:
    return CategoryOut.model_validate(CategoryService(db).create(body))


@categories.patch("/{category_id}", response_model=CategoryOut)
def update_category(category_id: int, body: CategoryUpdate, db: DbSession) -> CategoryOut:
    return CategoryOut.model_validate(CategoryService(db).update(category_id, body))


@categories.delete("/{category_id}", response_model=Message)
def delete_category(category_id: int, db: DbSession) -> Message:
    CategoryService(db).delete(category_id)
    return Message(detail="Category deleted")


router.include_router(categories)
router.include_router(build_crud_router(
    "/colors", "admin: colors", Color,
    CrudConfig(label="Color", search_fields=("name",), slug_source="name", default_order=("name",)),
    ColorIn, ColorUpdate, ColorOut))
router.include_router(build_crud_router(
    "/materials", "admin: materials", Material,
    CrudConfig(label="Material", search_fields=("name",), slug_source="name", default_order=("name",)),
    MaterialIn, MaterialUpdate, MaterialOut))
router.include_router(build_crud_router(
    "/rooms", "admin: rooms", Room,
    CrudConfig(label="Room", search_fields=("name",), slug_source="name", default_order=("sort_order", "name")),
    RoomIn, RoomUpdate, RoomOut))
