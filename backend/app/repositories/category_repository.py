from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Category, Product
from app.repositories.base import Repository


class CategoryRepository(Repository[Category]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, Category)

    def all_ordered(self, active_only: bool = False) -> list[Category]:
        stmt = select(Category).order_by(Category.sort_order, Category.name)
        if active_only:
            stmt = stmt.where(Category.is_active.is_(True))
        return list(self.db.scalars(stmt))

    def descendant_ids(self, root_id: int) -> list[int]:
        """Root id plus all descendants (walks the in-memory parent map; category tables are small)."""
        children: dict[int | None, list[int]] = {}
        for cid, pid in self.db.execute(select(Category.id, Category.parent_id)):
            children.setdefault(pid, []).append(cid)
        result, stack = [], [root_id]
        while stack:
            current = stack.pop()
            result.append(current)
            stack.extend(children.get(current, []))
        return result

    def ancestors(self, category: Category) -> list[Category]:
        chain: list[Category] = []
        seen: set[int] = set()
        node: Category | None = category
        while node is not None and node.id not in seen:
            seen.add(node.id)
            chain.append(node)
            node = self.get(node.parent_id) if node.parent_id else None
        return list(reversed(chain))

    def published_product_counts(self) -> dict[int, int]:
        rows = self.db.execute(
            select(Product.category_id, func.count(Product.id))
            .where(Product.is_published.is_(True), Product.category_id.is_not(None))
            .group_by(Product.category_id)
        )
        return {cid: count for cid, count in rows}

    def is_descendant(self, candidate_id: int, ancestor_id: int) -> bool:
        return candidate_id in self.descendant_ids(ancestor_id)
