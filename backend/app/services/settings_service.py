import re
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ValidationAppError
from app.core.site_settings import DEFAULT_SETTINGS, PRIVATE_KEYS
from app.models import Setting

_HEX = re.compile(r"^#[0-9a-fA-F]{6}$")
_PHONE_DIGITS = re.compile(r"^[0-9]{8,15}$")
_MAX_VALUE_LENGTH = 5000


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
        existing = {s.key: s for s in self.db.scalars(select(Setting).where(Setting.key.in_(cleaned)))}
        for key, value in cleaned.items():
            if key in existing:
                existing[key].value = value
            else:
                self.db.add(Setting(key=key, value=value))
        self.db.commit()
        return self.all()
