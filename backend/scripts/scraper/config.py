import os
from dataclasses import dataclass, field
from pathlib import Path


@dataclass(frozen=True)
class ScraperConfig:
    base_url: str = os.getenv("SCRAPER_BASE_URL", "https://hatil.com")
    sitemap_urls: tuple[str, ...] = field(default_factory=lambda: tuple(
        u for u in os.getenv("SCRAPER_SITEMAPS", "https://hatil.com/sitemap.xml").split(",") if u))
    user_agent: str = os.getenv(
        "SCRAPER_USER_AGENT",
        "CatalogImporter/1.0 (+catalog data import; contact: admin@example.com; respects robots.txt)",
    )
    requests_per_second: float = float(os.getenv("SCRAPER_RPS", "1.5"))
    max_retries: int = int(os.getenv("SCRAPER_MAX_RETRIES", "4"))
    backoff_base: float = float(os.getenv("SCRAPER_BACKOFF", "2.0"))
    timeout: float = float(os.getenv("SCRAPER_TIMEOUT", "30"))
    max_attempts_per_url: int = 3
    max_image_bytes: int = 15 * 1024 * 1024
    max_images_per_product: int = 8
    use_playwright: bool = os.getenv("SCRAPER_PLAYWRIGHT", "auto") != "off"
    output_dir: Path = Path(os.getenv("SCRAPER_OUTPUT_DIR", "scraper_output"))
    # Path segments that are never product categories.
    non_product_prefixes: frozenset[str] = frozenset({"blog", "showrooms", "showroom", "catalogues", "careers"})

    @property
    def min_interval(self) -> float:
        return 1.0 / max(self.requests_per_second, 0.1)
