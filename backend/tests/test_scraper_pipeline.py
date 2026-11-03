from dataclasses import replace
from pathlib import Path

import httpx
import pytest
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app.core.enums import ScrapeStatus
from app.models import Product, ScrapeLog
from scraper.config import ScraperConfig
from scraper.http import FetchError, PoliteClient, RobotsDisallowedError
from scraper.pipeline import ScrapeRun
from tests.conftest import png_bytes

FIXTURES = Path(__file__).parent / "fixtures"
SITE = "https://shop.example.com"
ROBOTS = "User-Agent: *\nAllow: /\nDisallow: /checkout\nDisallow: /bed/\n"


def make_transport(fail_once: set[str] | None = None) -> tuple[httpx.MockTransport, list[str]]:
    calls: list[str] = []
    fail_once = set(fail_once or ())
    product_html = (FIXTURES / "product_flight.html").read_text(encoding="utf-8")
    sitemap = (FIXTURES / "sitemap.xml").read_text(encoding="utf-8")

    def handler(request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        calls.append(url)
        if url in fail_once:
            fail_once.discard(url)
            return httpx.Response(503)
        if url == f"{SITE}/robots.txt":
            return httpx.Response(200, text=ROBOTS)
        if url == f"{SITE}/sitemap.xml":
            return httpx.Response(200, text=sitemap)
        if url == f"{SITE}/sofa/testwood-101":
            return httpx.Response(200, text=product_html)
        if url == f"{SITE}/content/testwood-102":
            return httpx.Response(200, text="<html><body>broken page</body></html>")
        if url.startswith("https://cdn.example.com/") and not url.endswith("robots.txt"):
            return httpx.Response(200, content=png_bytes("green"))
        return httpx.Response(404)

    return httpx.MockTransport(handler), calls


def make_config(tmp_path: Path) -> ScraperConfig:
    return replace(ScraperConfig(), base_url=SITE, sitemap_urls=(f"{SITE}/sitemap.xml",), requests_per_second=1000,
                   backoff_base=0.0, max_retries=2, use_playwright=False, output_dir=tmp_path)


def make_client(config: ScraperConfig, transport: httpx.MockTransport) -> PoliteClient:
    return PoliteClient(config, client=httpx.Client(transport=transport), sleep=lambda _s: None)


def test_client_respects_robots_and_retries(tmp_path: Path) -> None:
    config = make_config(tmp_path)
    transport, calls = make_transport(fail_once={f"{SITE}/sofa/testwood-101"})
    client = make_client(config, transport)
    with pytest.raises(RobotsDisallowedError):
        client.get_text(f"{SITE}/checkout")
    assert "Testwood-101" in client.get_text(f"{SITE}/sofa/testwood-101")
    assert calls.count(f"{SITE}/sofa/testwood-101") == 2  # one 503 then success
    with pytest.raises(FetchError):
        client.get_text(f"{SITE}/missing/page")


def test_full_run_imports_reports_and_resumes(tmp_path: Path, engine) -> None:  # noqa: ANN001
    config = make_config(tmp_path)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    transport, _ = make_transport()

    report = ScrapeRun(config, factory, make_client(config, transport)).run("all")
    assert report.discovered == 3
    assert report.created == 1 and report.failed == 1 and report.skipped == 1  # /bed/ is robots-disallowed

    with factory() as db:
        product = db.scalar(select(Product).where(Product.sku == "201-101-10-1-67"))
        assert product is not None and product.slug == "testwood-101"
        assert len(product.images) == 3 and product.images[0].path.endswith(".webp")
        assert sum(i.is_dimension for i in product.images) == 1
        assert len(product.variants) == 2
        assert "HATIL" not in (product.description_html or "")  # rebranded
        statuses = {row.url.rsplit("/", 1)[-1]: row.status for row in db.scalars(select(ScrapeLog))}
        assert statuses == {"testwood-101": ScrapeStatus.DONE, "testwood-102": ScrapeStatus.FAILED,
                            "sleepwell-5": ScrapeStatus.SKIPPED}

    assert list(tmp_path.glob("report-*.md")) and list(tmp_path.glob("products-*.csv"))

    # Resume only retries unfinished URLs; a re-run of --all updates instead of duplicating.
    resumed = ScrapeRun(config, factory, make_client(config, make_transport()[0])).run("resume")
    assert resumed.attempted == 1 and resumed.failed == 1
    again = ScrapeRun(config, factory, make_client(config, make_transport()[0])).run("all")
    assert again.created == 0 and again.updated == 1
    with factory() as db:
        assert db.query(Product).count() == 1


def test_category_mode_filters_urls(tmp_path: Path, engine) -> None:  # noqa: ANN001
    config = make_config(tmp_path)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    report = ScrapeRun(config, factory, make_client(config, make_transport()[0])).run("category", category="sofa")
    assert report.attempted == 1 and report.created == 1


@pytest.mark.parametrize("rps", [1.0, 1.5, 5, 1000])
def test_request_rate_is_never_faster_than_one_per_second(rps: float) -> None:
    assert replace(ScraperConfig(), requests_per_second=rps).min_interval >= 1.0


def test_slower_request_rates_are_honoured() -> None:
    assert replace(ScraperConfig(), requests_per_second=0.5).min_interval == 2.0


def test_default_config_respects_the_rate_floor() -> None:
    assert ScraperConfig().min_interval >= 1.0
