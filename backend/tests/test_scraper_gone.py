"""404/410 handling: product URLs that no longer exist are recorded as "gone", never retried, never raise."""

from collections.abc import Callable
from pathlib import Path

import httpx
import pytest
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app.core.enums import ScrapeStatus
from app.models import Product, ScrapeLog
from scraper.http import FetchError, GoneError
from scraper.pipeline import ScrapeRun, render_report
from tests.conftest import png_bytes
from tests.test_scraper_pipeline import FIXTURES, SITE, make_client, make_config

PRODUCT_URL = f"{SITE}/sofa/testwood-101"
CATEGORY_URL = f"{SITE}/sofa-price-in-bangladesh"
SITEMAP = f"""<?xml version="1.0" encoding="utf-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>{PRODUCT_URL}</loc></url></urlset>"""
CATEGORY_PAGE_1 = f"""<html><body><a href="{PRODUCT_URL}">Testwood</a>
<a rel="next" href="{CATEGORY_URL}?page=2">Next</a></body></html>"""


def make_transport(overrides: dict[str, int]) -> tuple[httpx.MockTransport, list[str]]:
    """Serves a one-product site. `overrides` maps URL -> status code, and can be changed between runs."""
    calls: list[str] = []
    product_html = (FIXTURES / "product_flight.html").read_text(encoding="utf-8")

    def handler(request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        calls.append(url)
        if url in overrides:
            return httpx.Response(overrides[url])
        if url == f"{SITE}/robots.txt":
            return httpx.Response(200, text="User-agent: *\nAllow: /\n")
        if url == f"{SITE}/sitemap.xml":
            return httpx.Response(200, text=SITEMAP)
        if url == PRODUCT_URL:
            return httpx.Response(200, text=product_html)
        if url == CATEGORY_URL:
            return httpx.Response(200, text=CATEGORY_PAGE_1)
        if url.startswith("https://cdn.example.com/") and not url.endswith("robots.txt"):
            return httpx.Response(200, content=png_bytes("green"))
        return httpx.Response(404)

    return httpx.MockTransport(handler), calls


def runner(tmp_path: Path, engine, overrides: dict[str, int]) -> tuple[Callable[[], ScrapeRun], list[str], sessionmaker]:  # noqa: ANN001
    config = make_config(tmp_path)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    transport, calls = make_transport(overrides)
    return (lambda: ScrapeRun(config, factory, make_client(config, transport))), calls, factory


@pytest.mark.parametrize("status", [404, 410])
def test_client_raises_gone_error_without_retrying(tmp_path: Path, status: int) -> None:
    config = make_config(tmp_path)
    transport, calls = make_transport({PRODUCT_URL: status})
    client = make_client(config, transport)

    with pytest.raises(GoneError) as exc_info:
        client.get_text(PRODUCT_URL)

    assert exc_info.value.status_code == status
    assert isinstance(exc_info.value, FetchError)  # existing `except FetchError` callers keep working
    assert calls.count(PRODUCT_URL) == 1


def test_server_errors_still_retry_with_backoff(tmp_path: Path) -> None:
    config = make_config(tmp_path)  # max_retries=2
    transport, calls = make_transport({PRODUCT_URL: 503})
    client = make_client(config, transport)

    with pytest.raises(FetchError) as exc_info:
        client.get_text(PRODUCT_URL)

    assert not isinstance(exc_info.value, GoneError)
    assert calls.count(PRODUCT_URL) == 3


@pytest.mark.parametrize("status", [404, 410])
def test_gone_product_is_logged_reported_and_never_raises(tmp_path: Path, engine, status: int) -> None:  # noqa: ANN001
    make_run, _, factory = runner(tmp_path, engine, {PRODUCT_URL: status})

    report = make_run().run("all")

    assert report.gone == 1 and report.failed == 0 and report.created == 0
    assert report.gone_urls == [{"url": PRODUCT_URL, "status": str(status)}]
    with factory() as db:
        entry = db.scalar(select(ScrapeLog).where(ScrapeLog.url == PRODUCT_URL))
        assert entry.status == ScrapeStatus.GONE and entry.attempts == 1
        assert entry.error == f"HTTP {status}"
    markdown = render_report(report)
    assert "- Gone (HTTP 404/410): 1" in markdown and PRODUCT_URL in markdown


def test_gone_keeps_existing_product_published_and_resume_skips_it(tmp_path: Path, engine) -> None:  # noqa: ANN001
    overrides: dict[str, int] = {}
    make_run, calls, factory = runner(tmp_path, engine, overrides)
    assert make_run().run("all").created == 1

    overrides[PRODUCT_URL] = 404  # the product is discontinued at the source
    second = make_run().run("all")

    assert second.gone == 1 and second.updated == 0
    with factory() as db:
        product = db.scalar(select(Product).where(Product.sku == "201-101-10-1-67"))
        assert product is not None and product.is_published is True

    calls.clear()
    resumed = make_run().run("resume")

    assert resumed.attempted == 0 and resumed.gone == 0
    assert PRODUCT_URL not in calls


def test_category_page_404_mid_pagination_keeps_found_links(tmp_path: Path, engine) -> None:  # noqa: ANN001
    make_run, calls, _ = runner(tmp_path, engine, {f"{CATEGORY_URL}?page=2": 404})

    report = make_run().run("category", category="sofa")

    assert f"{CATEGORY_URL}?page=2" in calls  # pagination reached page 2 and stopped there
    assert report.discovered == 1 and report.created == 1 and report.failed == 0
