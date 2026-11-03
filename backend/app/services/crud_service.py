# Deferred annotations: the `list` method below would otherwise shadow the builtin in
# `list[...]` annotations on Python < 3.14 (TypeError at import time).
from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass, field
from typing import Any, Generic, TypeVar

from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, NotFoundError
from app.core.text import sanitize_html, slugify
from app.db.base import Base
from app.repositories.base import Repository
from app.schemas.common import PageParams, SortOrderItem

M = TypeVar("M", bound=Base)


@dataclass(frozen=True)
class CrudConfig:
    """Describes how a simple entity is created/edited/searched."""

    label: str
    search_fields: Sequence[str] = ()
    html_fields: Sequence[str] = ()
    slug_source: str | None = None  # field used to auto-generate `slug`
    unique_fields: Sequence[str] = ()
    default_order: Sequence[str] = ("id",)
    filter_fields: Sequence[str] = field(default_factory=tuple)


class CrudService(Generic[M]):
    def __init__(self, db: Session, model: type[M], config: CrudConfig) -> None:
        self.db = db
        self.repo = Repository(db, model)
        self.model = model
        self.config = config

    def list(self, params: PageParams, q: str | None = None, **filters: Any) -> tuple[list[M], int]:
        allowed = {k: v for k, v in filters.items() if k in self.config.filter_fields}
        stmt = self.repo.search_query(q, self.config.search_fields, **allowed)
        stmt = stmt.order_by(*(self._order_col(o) for o in self.config.default_order))
        return self.repo.paginate(stmt, params.offset, params.page_size)

    def get(self, obj_id: int) -> M:
        obj = self.repo.get(obj_id)
        if obj is None:
            raise NotFoundError(f"{self.config.label} not found")
        return obj

    def create(self, data: BaseModel) -> M:
        values = self._prepare(data.model_dump(), None)
        obj = self.repo.add(self.model(**values))
        self.db.commit()
        return obj

    def update(self, obj_id: int, data: BaseModel) -> M:
        obj = self.get(obj_id)
        values = self._prepare(data.model_dump(exclude_unset=True), obj)
        self.repo.update(obj, values)
        self.db.commit()
        return obj

    def delete(self, obj_id: int) -> None:
        self.repo.delete(self.get(obj_id))
        self.db.commit()

    def reorder(self, items: list[SortOrderItem]) -> None:
        for item in items:
            obj = self.repo.get(item.id)
            if obj is not None and hasattr(obj, "sort_order"):
                obj.sort_order = item.sort_order
        self.db.commit()

    def _prepare(self, values: dict[str, Any], existing: M | None) -> dict[str, Any]:
        for name in self.config.html_fields:
            if name in values:
                values[name] = sanitize_html(values[name])
        if self.config.slug_source:
            values = self._with_slug(values, existing)
        for name in self.config.unique_fields:
            if name in values and values[name] is not None:
                clash = self.repo.get_by(**{name: values[name]})
                if clash is not None and (existing is None or clash.id != existing.id):
                    raise ConflictError(f"{self.config.label} with this {name} already exists")
        return values

    def _with_slug(self, values: dict[str, Any], existing: M | None) -> dict[str, Any]:
        explicit = values.get("slug")
        if explicit:
            base = slugify(explicit)
        elif existing is None:
            base = slugify(str(values.get(self.config.slug_source, "")))
        else:
            values.pop("slug", None)
            return values
        values["slug"] = self.repo.unique_slug(base, exclude_id=existing.id if existing else None)
        return values

    def _order_col(self, name: str) -> Any:
        desc = name.startswith("-")
        col = getattr(self.model, name.lstrip("-"))
        return col.desc() if desc else col.asc()
