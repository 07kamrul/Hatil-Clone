from functools import lru_cache

from app.core.config import get_settings
from app.storage.base import StorageService, StoredImage
from app.storage.local import LocalStorage


@lru_cache
def get_storage() -> StorageService:
    settings = get_settings()
    if settings.storage_backend == "s3":
        from app.storage.s3 import S3Storage

        return S3Storage(settings.s3_bucket, settings.s3_region, settings.s3_public_url)
    return LocalStorage(settings.upload_dir, settings.upload_url_prefix)


__all__ = ["StorageService", "StoredImage", "get_storage"]
