from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, File, Query, Response, UploadFile, status

from app.api.v1.filters import product_filters
from app.core.config import get_settings
from app.core.deps import DbSession
from app.core.errors import ValidationAppError
from app.schemas.catalog import (
    BulkPrice,
    BulkPublish,
    ImageReorder,
    ImageUpdate,
    ImportResult,
    ProductCard,
    ProductDetail,
    ProductFilters,
    ProductIn,
    ProductUpdate,
)
from app.schemas.common import IdList, Message, Page, PageParams
from app.services.product_import_service import ProductImporter, export_products
from app.services.product_service import ProductService

router = APIRouter(prefix="/products", tags=["admin: products"])

MAX_IMAGES_PER_REQUEST = 20
MAX_IMPORT_MB = 20


@router.get("", response_model=Page[ProductCard])
def list_products(
    db: DbSession,
    filters: Annotated[ProductFilters, Depends(product_filters)],
    params: Annotated[PageParams, Depends()],
    published: bool | None = Query(None, description="Filter by publish state; omit for all"),
) -> Page[ProductCard]:
    return ProductService(db).search(filters.model_copy(update={"published": published}), params)


@router.get("/export")
def export(db: DbSession, fmt: str = Query("csv", pattern="^(csv|xlsx)$")) -> Response:
    content = export_products(db, fmt)
    stamp = datetime.now(UTC).strftime("%Y%m%d-%H%M")
    media = "text/csv" if fmt == "csv" else "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    return Response(content, media_type=media,
                    headers={"Content-Disposition": f'attachment; filename="products-{stamp}.{fmt}"'})


@router.post("/import", response_model=ImportResult)
async def import_products(db: DbSession, file: UploadFile = File(...)) -> ImportResult:
    content = await file.read(MAX_IMPORT_MB * 1024 * 1024 + 1)
    if len(content) > MAX_IMPORT_MB * 1024 * 1024:
        raise ValidationAppError(f"Import file exceeds {MAX_IMPORT_MB} MB")
    return ProductImporter(db).import_file(content, file.filename or "upload.csv")


@router.post("/bulk/publish", response_model=Message)
def bulk_publish(body: BulkPublish, db: DbSession) -> Message:
    count = ProductService(db).bulk_publish(body.ids, body.is_published)
    return Message(detail=f"{count} products {'published' if body.is_published else 'unpublished'}")


@router.post("/bulk/price", response_model=Message)
def bulk_price(body: BulkPrice, db: DbSession) -> Message:
    count = ProductService(db).bulk_price(body)
    return Message(detail=f"Updated prices of {count} products")


@router.post("/bulk/delete", response_model=Message)
def bulk_delete(body: IdList, db: DbSession) -> Message:
    count = ProductService(db).bulk_delete(body.ids)
    return Message(detail=f"Deleted {count} products")


@router.get("/{product_id}", response_model=ProductDetail)
def get_product(product_id: int, db: DbSession) -> ProductDetail:
    return ProductService(db).get_detail(product_id)


@router.post("", response_model=ProductDetail, status_code=status.HTTP_201_CREATED)
def create_product(body: ProductIn, db: DbSession) -> ProductDetail:
    return ProductService(db).create(body)


@router.patch("/{product_id}", response_model=ProductDetail)
def update_product(product_id: int, body: ProductUpdate, db: DbSession) -> ProductDetail:
    return ProductService(db).update(product_id, body)


@router.delete("/{product_id}", response_model=Message)
def delete_product(product_id: int, db: DbSession) -> Message:
    ProductService(db).delete(product_id)
    return Message(detail="Product deleted")


@router.post("/{product_id}/images", response_model=ProductDetail)
async def upload_images(product_id: int, db: DbSession, files: list[UploadFile] = File(...)) -> ProductDetail:
    if len(files) > MAX_IMAGES_PER_REQUEST:
        raise ValidationAppError(f"Upload at most {MAX_IMAGES_PER_REQUEST} images at a time")
    limit = get_settings().max_upload_mb * 1024 * 1024
    payload = [(await f.read(limit + 1), f.filename or "image") for f in files]
    return ProductService(db).add_images(product_id, payload)


@router.put("/{product_id}/images/order", response_model=ProductDetail)
def reorder_images(product_id: int, body: ImageReorder, db: DbSession) -> ProductDetail:
    return ProductService(db).reorder_images(product_id, body.image_ids)


@router.patch("/{product_id}/images/{image_id}", response_model=ProductDetail)
def update_image(product_id: int, image_id: int, body: ImageUpdate, db: DbSession) -> ProductDetail:
    return ProductService(db).update_image(product_id, image_id, body.model_dump(exclude_unset=True))


@router.delete("/{product_id}/images/{image_id}", response_model=ProductDetail)
def delete_image(product_id: int, image_id: int, db: DbSession) -> ProductDetail:
    return ProductService(db).delete_image(product_id, image_id)
