from fastapi import APIRouter, File, Query, UploadFile

from app.core.config import get_settings
from app.core.errors import ValidationAppError
from app.schemas.system import UploadOut
from app.storage import get_storage
from app.storage.base import InvalidImageError

router = APIRouter(prefix="/uploads", tags=["admin: uploads"])

ALLOWED_FOLDERS = {"banners", "categories", "rooms", "showrooms", "blog", "pages", "branding", "misc"}


@router.post("/image", response_model=UploadOut)
async def upload_image(file: UploadFile = File(...), folder: str = Query("misc")) -> UploadOut:
    if folder not in ALLOWED_FOLDERS:
        raise ValidationAppError(f"folder must be one of {sorted(ALLOWED_FOLDERS)}")
    limit = get_settings().max_upload_mb * 1024 * 1024
    data = await file.read(limit + 1)
    try:
        stored = get_storage().save_image(data, folder, (file.filename or "image").rsplit(".", 1)[0])
    except InvalidImageError as exc:
        raise ValidationAppError(str(exc)) from exc
    return UploadOut(url=stored.url, thumb_url=stored.thumb_url)
