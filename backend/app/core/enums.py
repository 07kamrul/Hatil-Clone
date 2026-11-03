from enum import StrEnum


class StockStatus(StrEnum):
    IN_STOCK = "in_stock"
    OUT_OF_STOCK = "out_of_stock"
    PRE_ORDER = "pre_order"
    MADE_TO_ORDER = "made_to_order"


class AdminRole(StrEnum):
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"


class BannerPlacement(StrEnum):
    HERO = "hero"
    OFFER = "offer"
    PROMO = "promo"


class InquiryStatus(StrEnum):
    NEW = "new"
    CONTACTED = "contacted"
    CLOSED = "closed"


class InquirySource(StrEnum):
    CART = "cart"
    PRODUCT = "product"


class ScrapeStatus(StrEnum):
    PENDING = "pending"
    DONE = "done"
    FAILED = "failed"
    SKIPPED = "skipped"
    GONE = "gone"  # source returned 404/410; never retried


class ProductSort(StrEnum):
    NEWEST = "new"
    PRICE_ASC = "price_asc"
    PRICE_DESC = "price_desc"
    POPULAR = "popular"
    NAME = "name"
