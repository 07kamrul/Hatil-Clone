import io
import secrets
from abc import ABC, abstractmethod
from dataclasses import dataclass

from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.config import get_settings

MAX_DIMENSION = 2000
WEBP_QUALITY = 82
MAX_PIXELS = 50_000_000  # decompression-bomb guard


class InvalidImageError(ValueError):
    pass


@dataclass(frozen=True)
class StoredImage:
    url: str
    thumb_url: str


def to_webp(data: bytes, max_side: int) -> bytes:
    """Validate an uploaded image and re-encode it as WebP (strips metadata, bounded size)."""
    Image.MAX_IMAGE_PIXELS = MAX_PIXELS
    try:
        with Image.open(io.BytesIO(data)) as img:
            img = ImageOps.exif_transpose(img)
            if img.mode not in ("RGB", "RGBA"):
                img = img.convert("RGBA" if "A" in img.getbands() else "RGB")
            img.thumbnail((max_side, max_side))
            out = io.BytesIO()
            img.save(out, format="WEBP", quality=WEBP_QUALITY, method=4)
            return out.getvalue()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise InvalidImageError("File is not a valid image") from exc


class StorageService(ABC):
    """Stores binary objects under a key and returns public URLs. Swap implementations via STORAGE_BACKEND."""

    @abstractmethod
    def put(self, key: str, data: bytes, content_type: str) -> str: ...

    @abstractmethod
    def delete(self, url: str) -> None: ...

    def save_image(self, data: bytes, folder: str, name_hint: str = "") -> StoredImage:
        settings = get_settings()
        if len(data) > settings.max_upload_mb * 1024 * 1024:
            raise InvalidImageError(f"Image exceeds {settings.max_upload_mb} MB")
        full = to_webp(data, MAX_DIMENSION)
        thumb = to_webp(full, settings.thumbnail_size)
        stem = _safe_stem(name_hint) + "-" + secrets.token_hex(4)
        url = self.put(f"{folder}/{stem}.webp", full, "image/webp")
        thumb_url = self.put(f"{folder}/thumbs/{stem}.webp", thumb, "image/webp")
        return StoredImage(url=url, thumb_url=thumb_url)

    def save_file(self, data: bytes, folder: str, filename: str, content_type: str) -> str:
        stem, _, ext = filename.rpartition(".")
        safe_ext = "".join(c for c in ext.lower() if c.isalnum())[:5] or "bin"
        return self.put(f"{folder}/{_safe_stem(stem)}-{secrets.token_hex(4)}.{safe_ext}", data, content_type)


def _safe_stem(hint: str) -> str:
    cleaned = "".join(c if c.isalnum() else "-" for c in hint.lower()).strip("-")
    while "--" in cleaned:
        cleaned = cleaned.replace("--", "-")
    return cleaned[:60] or "file"
