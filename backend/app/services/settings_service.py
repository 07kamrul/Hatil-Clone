import re
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ValidationAppError
from app.core.site_settings import DEFAULT_SETTINGS, PRIVATE_KEYS
from app.models import Setting

_HEX = re.compile(r"^#[0-9a-fA-F]{6}$")
_PHONE_DIGITS = re.compile(r"^[0-9]{8,15}$")
_AT_COORDS = re.compile(r"@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)")
_QUERY_COORDS = re.compile(r"[?&](?:q|ll|query|destination)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)")
_PLACE_COORDS = re.compile(r"!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)")
_MAPS_HOSTS = ("google.com", "maps.google", "goo.gl")
_MAX_VALUE_LENGTH = 5000


def parse_google_maps_link(url: str) -> tuple[float, float] | None:
    """Extract (lat, lng) from a Google Maps URL, or None if none is embedded."""
    host = url.lower()
    if not any(h in host for h in _MAPS_HOSTS):
        return None
    for pattern in (_AT_COORDS, _QUERY_COORDS, _PLACE_COORDS):
        match = pattern.search(url)
        if match:
            lat, lng = float(match.group(1)), float(match.group(2))
            if -90 <= lat <= 90 and -180 <= lng <= 180:
                return (lat, lng)
    return None


def _validate(key: str, value: Any) -> Any:
    if key not in DEFAULT_SETTINGS:
        raise ValidationAppError(f"Unknown setting '{key}'")
    if isinstance(value, str):
        value = value.strip()
        if len(value) > _MAX_VALUE_LENGTH:
            raise ValidationAppError(f"Setting '{key}' is too long")
    if key in ("primary_color", "accent_color") and value and not _HEX.match(value):
        raise ValidationAppError(f"'{key}' must be a hex colour like #8a5a2b")
    if key == "whatsapp_number":
        digits = re.sub(r"\D", "", str(value or ""))
        if not _PHONE_DIGITS.match(digits):
            raise ValidationAppError("WhatsApp number must be 8–15 digits incl. country code")
        value = digits
    if key == "log_inquiries":
        value = bool(value)
    if key in ("map_lat", "map_lng") and value not in (None, ""):
        try:
            value = float(value)
        except (TypeError, ValueError):
            raise ValidationAppError(f"'{key}' must be a number") from None
        lo, hi = (-90.0, 90.0) if key == "map_lat" else (-180.0, 180.0)
        if not lo <= value <= hi:
            raise ValidationAppError(f"'{key}' must be between {lo:g} and {hi:g}")
    if key == "map_zoom" and value not in (None, ""):
        try:
            value = int(value)
        except (TypeError, ValueError):
            raise ValidationAppError(f"'{key}' must be a number") from None
        if not 1 <= value <= 20:
            raise ValidationAppError("'map_zoom' must be between 1 and 20")
    if key == "map_link" and value:
        if not str(value).startswith("https://") or not any(h in str(value).lower() for h in _MAPS_HOSTS):
            raise ValidationAppError("'map_link' must be a https:// Google Maps link")
    return value


class SettingsService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def all(self) -> dict[str, Any]:
        stored = {s.key: s.value for s in self.db.scalars(select(Setting))}
        return {key: stored.get(key, default) for key, default in DEFAULT_SETTINGS.items()}

    def public(self) -> dict[str, Any]:
        return {k: v for k, v in self.all().items() if k not in PRIVATE_KEYS}

    def get(self, key: str) -> Any:
        row = self.db.scalar(select(Setting).where(Setting.key == key))
        return row.value if row else DEFAULT_SETTINGS.get(key)

    def update(self, values: dict[str, Any]) -> dict[str, Any]:
        cleaned = {key: _validate(key, value) for key, value in values.items()}
        link = cleaned.get("map_link")
        if link:
            coords = parse_google_maps_link(str(link))
            if coords and "map_lat" not in cleaned and "map_lng" not in cleaned:
                cleaned["map_lat"], cleaned["map_lng"] = coords
        existing = {s.key: s for s in self.db.scalars(select(Setting).where(Setting.key.in_(cleaned)))}
        for key, value in cleaned.items():
            if key in existing:
                existing[key].value = value
            else:
                self.db.add(Setting(key=key, value=value))
        self.db.commit()
        return self.all()
