import math
from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")

MAX_PAGE_SIZE = 100


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class PageParams(BaseModel):
    page: int = Field(1, ge=1)
    page_size: int = Field(24, ge=1, le=MAX_PAGE_SIZE)

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    pages: int

    @classmethod
    def build(cls, items: list[T], total: int, params: PageParams) -> "Page[T]":
        return cls(items=items, total=total, page=params.page, page_size=params.page_size,
                   pages=math.ceil(total / params.page_size) if total else 0)


class Message(BaseModel):
    detail: str


class IdList(BaseModel):
    ids: list[int] = Field(min_length=1, max_length=1000)


class SortOrderItem(BaseModel):
    id: int
    sort_order: int
