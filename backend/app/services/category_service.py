from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, NotFoundError, ValidationAppError
from app.core.text import sanitize_html, slugify
from app.mappers.catalog import build_category_tree, category_ref
from app.models import Category, Product
from app.repositories.category_repository import CategoryRepository
from app.schemas.catalog import CategoryDetail, CategoryIn, CategoryNode, CategoryOut, CategoryUpdate


class CategoryService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = CategoryRepository(db)

    def tree(self, active_only: bool) -> list[CategoryNode]:
        categories = self.repo.all_ordered(active_only=active_only)
        if active_only:
            categories = [c for c in categories if c.show_in_menu]
        return build_category_tree(categories, self.repo.published_product_counts())

    def list_flat(self) -> list[Category]:
        return self.repo.all_ordered()

    def get(self, category_id: int) -> Category:
        category = self.repo.get(category_id)
        if category is None:
            raise NotFoundError("Category not found")
        return category

    def get_public(self, slug: str) -> CategoryDetail:
        category = self.repo.get_by(slug=slug, is_active=True)
        if category is None:
            raise NotFoundError("Category not found")
        children = [c for c in category.children if c.is_active]
        return CategoryDetail(
            **CategoryOut.model_validate(category).model_dump(),
            breadcrumbs=[category_ref(c) for c in self.repo.ancestors(category)],
            children=[category_ref(c) for c in children],
        )

    def create(self, data: CategoryIn) -> Category:
        values = data.model_dump()
        self._validate_parent(values.get("parent_id"), None)
        values["description_html"] = sanitize_html(values.get("description_html"))
        values["slug"] = self._slug(values.pop("slug", None) or values["name"], None)
        category = self.repo.add(Category(**values))
        self.db.commit()
        return category

    def update(self, category_id: int, data: CategoryUpdate) -> Category:
        category = self.get(category_id)
        values = data.model_dump(exclude_unset=True)
        if "parent_id" in values:
            self._validate_parent(values["parent_id"], category.id)
        if "description_html" in values:
            values["description_html"] = sanitize_html(values["description_html"])
        if values.get("slug"):
            values["slug"] = self._slug(values["slug"], category.id)
        else:
            values.pop("slug", None)
        self.repo.update(category, values)
        self.db.commit()
        return category

    def delete(self, category_id: int) -> None:
        category = self.get(category_id)
        if self.db.scalar(select(Product.id).where(Product.category_id == category.id).limit(1)):
            raise ConflictError("Category has products; move or delete them first")
        # Re-attach children to the deleted node's parent so the tree stays connected.
        self.db.execute(update(Category).where(Category.parent_id == category.id)
                        .values(parent_id=category.parent_id))
        self.repo.delete(category)
        self.db.commit()

    def _slug(self, raw: str, exclude_id: int | None) -> str:
        return self.repo.unique_slug(slugify(raw), exclude_id)

    def _validate_parent(self, parent_id: int | None, self_id: int | None) -> None:
        if parent_id is None:
            return
        if self.repo.get(parent_id) is None:
            raise ValidationAppError("Parent category does not exist")
        if self_id is not None and self.repo.is_descendant(parent_id, self_id):
            raise ValidationAppError("A category cannot be moved under itself or its descendants")
