from collections.abc import Sequence
from typing import Any, Generic, TypeVar

from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session

from app.db.base import Base

M = TypeVar("M", bound=Base)


class Repository(Generic[M]):
    """Generic data access for a single model. Services own transactions (commit/rollback)."""

    def __init__(self, db: Session, model: type[M]) -> None:
        self.db = db
        self.model = model

    def get(self, obj_id: int) -> M | None:
        return self.db.get(self.model, obj_id)

    def get_by(self, **filters: Any) -> M | None:
        return self.db.scalar(select(self.model).filter_by(**filters).limit(1))

    def get_many(self, ids: Sequence[int]) -> list[M]:
        if not ids:
            return []
        return list(self.db.scalars(select(self.model).where(self.model.id.in_(ids))))

    def exists(self, **filters: Any) -> bool:
        return self.db.scalar(select(self.model.id).filter_by(**filters).limit(1)) is not None

    def search_query(self, q: str | None, fields: Sequence[str], **filters: Any) -> Select[tuple[M]]:
        stmt = select(self.model).filter_by(**{k: v for k, v in filters.items() if v is not None})
        if q:
            pattern = f"%{q.strip()}%"
            stmt = stmt.where(or_(*(getattr(self.model, f).ilike(pattern) for f in fields)))
        return stmt

    def paginate(self, stmt: Select[tuple[M]], offset: int, limit: int) -> tuple[list[M], int]:
        total = self.db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
        items = list(self.db.scalars(stmt.offset(offset).limit(limit)))
        return items, total

    def list_all(self, *order_by: Any, **filters: Any) -> list[M]:
        stmt = select(self.model).filter_by(**filters)
        if order_by:
            stmt = stmt.order_by(*order_by)
        return list(self.db.scalars(stmt))

    def add(self, obj: M) -> M:
        self.db.add(obj)
        self.db.flush()
        return obj

    def update(self, obj: M, values: dict[str, Any]) -> M:
        for key, value in values.items():
            setattr(obj, key, value)
        self.db.flush()
        return obj

    def delete(self, obj: M) -> None:
        self.db.delete(obj)
        self.db.flush()

    def unique_slug(self, base: str, exclude_id: int | None = None) -> str:
        slug, n = base, 2
        while True:
            stmt = select(self.model.id).where(self.model.slug == slug)
            if exclude_id is not None:
                stmt = stmt.where(self.model.id != exclude_id)
            if self.db.scalar(stmt.limit(1)) is None:
                return slug
            slug, n = f"{base}-{n}", n + 1
