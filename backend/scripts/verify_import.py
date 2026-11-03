"""Post-import verification (read-only): product count vs the scrape report, category tree, sample products
(full description, every image answers HTTP 200), sitemap coverage, a live spot-check against the source site,
and a final summary. Exits non-zero when a check fails.

    python -m scripts.verify_import --api https://<api-host>/api/v1 \
        --report report-<run>.md --products-json products-<run>.json
"""

import argparse
import json
import os
import random
import re
import sys
import time
from collections.abc import Callable
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path
from urllib.parse import urljoin

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent))  # lets `scraper.*` resolve like the scraper CLI does

from app.core.text import strip_tags  # noqa: E402
from scraper.config import ScraperConfig  # noqa: E402
from scraper.http import FetchError, PoliteClient, RobotsDisallowedError  # noqa: E402
from scraper.parsers import ParseError, parse_product  # noqa: E402

PAGE_SIZE = 100  # API maximum
DESCRIPTION_TOLERANCE = 0.25  # stored text is sanitised and rebranded, so only the size is compared
PRICE_TOLERANCE = Decimal("0.01")
MAX_LISTED = 20
MAX_RATE_LIMIT_RETRIES = 5
DEFAULT_RETRY_AFTER_SECONDS = 2
DIMENSION_IMAGES_KEPT = 2  # scripts/scraper/mapper.py keeps at most this many dimension drawings

_REPORT_FIELDS = {
    "discovered": r"URLs discovered: (\d+)", "attempted": r"Attempted: (\d+)", "created": r"Created: (\d+)",
    "updated": r"Updated: (\d+)", "failed": r"Failed: (\d+)", "skipped": r"Skipped[^:\n]*: (\d+)",
    "gone": r"Gone[^:\n]*: (\d+)",
}


@dataclass(frozen=True)
class Check:
    name: str
    ok: bool
    detail: str


# ---------- pure helpers ----------
def parse_report(text: str) -> dict[str, int]:
    matches = {key: re.search(pattern, text) for key, pattern in _REPORT_FIELDS.items()}
    return {key: int(m.group(1)) for key, m in matches.items() if m}


def count_nodes(tree: list[dict]) -> int:
    return sum(1 + count_nodes(node.get("children") or []) for node in tree)


def price_matches(api_price: float, api_sale: float | None, live_price: Decimal, live_sale: Decimal | None) -> bool:
    def close(a: float | Decimal, b: Decimal) -> bool:
        return abs(Decimal(str(a)) - b) < PRICE_TOLERANCE

    if (api_sale is None) != (live_sale is None):
        return False
    return close(api_price, live_price) and (api_sale is None or close(api_sale, live_sale))


def _plain(html: str | None) -> str:
    return " ".join(strip_tags(html or "").split())


def description_close(api_html: str | None, live_html: str | None) -> bool:
    api, live = _plain(api_html), _plain(live_html)
    if not api or not live:
        return api == live
    return abs(len(api) / len(live) - 1) <= DESCRIPTION_TOLERANCE


# ---------- API access ----------
def get_json(client: httpx.Client, url: str, sleep: Callable[[float], None] = time.sleep) -> dict | list:
    """GET JSON; waits and retries when the API rate-limits us (HTTP 429), then raises."""
    response = client.get(url)
    for _ in range(MAX_RATE_LIMIT_RETRIES):
        if response.status_code != 429:
            break
        retry_after = response.headers.get("Retry-After", "")
        sleep(int(retry_after) if retry_after.isdigit() else DEFAULT_RETRY_AFTER_SECONDS)
        response = client.get(url)
    response.raise_for_status()
    return response.json()


def list_cards(client: httpx.Client, api: str, total: int) -> list[dict]:
    cards: list[dict] = []
    page = 1
    while len(cards) < total:
        items = get_json(client, f"{api}/products?page={page}&page_size={PAGE_SIZE}")["items"]
        if not items:
            break
        cards = [*cards, *items]
        page += 1
    return cards


# ---------- checks ----------
def check_counts(total: int, counts: dict[str, int]) -> Check:
    if "created" not in counts:
        return Check("product count", True, f"{total} published products (no report given to compare)")
    expected = counts["created"] + counts.get("updated", 0)
    ok = total >= expected
    note = "equal" if total == expected else ("more: products that already existed" if ok else "FEWER than the report")
    return Check("product count", ok, f"API {total} vs report created+updated {expected} ({note})")


def check_tree(client: httpx.Client, api: str) -> Check:
    nodes = count_nodes(get_json(client, f"{api}/categories/tree"))
    return Check("categories/tree", nodes > 0, f"{nodes} categories")


def check_product(client: httpx.Client, api: str, media_base: str, slug: str) -> Check:
    detail = get_json(client, f"{api}/products/{slug}")
    problems = []
    if not _plain(detail.get("description_html")):
        problems.append("no description")
    images = detail.get("images") or []
    if not images:
        problems.append("no images")
    for image in images:
        status = client.get(urljoin(media_base + "/", image["url"])).status_code
        if status != 200:
            problems.append(f"{image['url']} -> HTTP {status}")
    return Check(f"product {slug}", not problems, "; ".join(problems) or f"{len(images)} images load")


def check_sitemap(client: httpx.Client, api: str, total: int, sample_slugs: list[str]) -> Check:
    xml = client.get(f"{api}/seo/sitemap.xml").text
    listed = set(re.findall(r"<loc>[^<]*/product/([^<]+)</loc>", xml))
    missing = [slug for slug in sample_slugs if slug not in listed]
    ok = len(listed) >= total and not missing
    return Check("sitemap", ok, f"{len(listed)} product URLs for {total} products; sampled missing: {missing or 'none'}")


def spot_check(polite: PoliteClient, client: httpx.Client, api: str, source_url: str, slug: str) -> Check:
    try:
        live = parse_product(polite.get_text(source_url), source_url)
    except (FetchError, RobotsDisallowedError, ParseError) as exc:
        return Check(f"spot {slug}", False, f"live source unavailable: {exc}")
    stored = get_json(client, f"{api}/products/{slug}")
    stored_images = sum(1 for image in stored["images"] if not image["is_dimension"])
    expected_images = min(len(live.images), ScraperConfig().max_images_per_product)
    prices = price_matches(stored["price"], stored["sale_price"], live.price, live.sale_price)
    texts = description_close(stored.get("description_html"), live.description_html)
    detail = (f"price stored {stored['price']}/{stored['sale_price']} live {live.price}/{live.sale_price}; "
              f"images stored {stored_images} live {expected_images}; description close: {texts}")
    return Check(f"spot {slug}", prices and texts and stored_images == expected_images, detail)


# ---------- full scan + summary ----------
def scan_all(client: httpx.Client, api: str, slugs: list[str]) -> dict:
    missing: dict[str, list[str]] = {"price": [], "image": [], "description": []}
    images = 0
    for slug in slugs:
        detail = get_json(client, f"{api}/products/{slug}")
        images += len(detail["images"])
        if not detail["price"] or detail["price"] <= 0:
            missing["price"].append(slug)
        if not detail["images"]:
            missing["image"].append(slug)
        if not _plain(detail.get("description_html")):
            missing["description"].append(slug)
    return {"images": images, "missing": missing}


def images_expected(products: list[dict]) -> int:
    cap = ScraperConfig().max_images_per_product
    return sum(min(len(p["images"]), cap) + min(len(p.get("dimension_images", [])), DIMENSION_IMAGES_KEPT)
               for p in products)


def print_check(check: Check) -> None:
    print(f"[{'PASS' if check.ok else 'FAIL'}] {check.name}: {check.detail}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--api", default=os.getenv("VERIFY_API"), help="API base, e.g. https://host/api/v1")
    parser.add_argument("--media-base", help="where /uploads/... is served (default: the API host)")
    parser.add_argument("--report", type=Path, help="report-<run>.md from the scraper")
    parser.add_argument("--products-json", type=Path, help="products-<run>.json (enables the live spot-check)")
    parser.add_argument("--samples", type=int, default=10)
    parser.add_argument("--spot", type=int, default=5)
    parser.add_argument("--seed", type=int, default=None)
    args = parser.parse_args()
    if not args.api:
        parser.error("--api (or VERIFY_API) is required")
    api = args.api.rstrip("/")
    media_base = (args.media_base or re.sub(r"/api/v\d+$", "", api)).rstrip("/")
    rng = random.Random(args.seed)  # noqa: S311 - picks sample products, not security-sensitive
    counts = parse_report(args.report.read_text(encoding="utf-8")) if args.report else {}
    products: list[dict] = json.loads(args.products_json.read_text(encoding="utf-8")) if args.products_json else []

    checks: list[Check] = []
    with httpx.Client(timeout=30, follow_redirects=True) as client:
        total = get_json(client, f"{api}/products?page=1&page_size=1")["total"]
        cards = list_cards(client, api, total)
        checks += [check_counts(total, counts), check_tree(client, api)]
        slugs = [card["slug"] for card in cards]
        sample = rng.sample(slugs, min(args.samples, len(slugs)))
        checks += [check_product(client, api, media_base, slug) for slug in sample]
        checks.append(check_sitemap(client, api, total, sample))
        slug_by_sku = {card["sku"]: card["slug"] for card in cards}
        candidates = [p for p in products if p["sku"] in slug_by_sku]  # products of this run that are in the API
        if candidates:
            polite = PoliteClient(ScraperConfig())  # throttled to <= 1 req/s, honours robots.txt
            checks += [spot_check(polite, client, api, p["source_url"], slug_by_sku[p["sku"]])
                       for p in rng.sample(candidates, min(args.spot, len(candidates)))]
            polite.close()
        scan = scan_all(client, api, [slug_by_sku[p["sku"]] for p in candidates] or slugs)

    for check in checks:
        print_check(check)
    print("\n== Final report ==")
    print(f"scraped (attempted) {counts.get('attempted', 'n/a')} | inserted {counts.get('created', 'n/a')} | "
          f"updated {counts.get('updated', 'n/a')} | failed {counts.get('failed', 'n/a')} | "
          f"skipped {counts.get('skipped', 'n/a')} | gone {counts.get('gone', 'n/a')}")
    if products:
        print(f"products of this run found in the API: {len(candidates)} of {len(products)}")
    downloaded = f" of {images_expected(products)} downloaded" if products else " (all products)"
    print(f"images stored {scan['images']}{downloaded}")
    for field, missing in scan["missing"].items():
        print(f"missing {field}: {len(missing)} {missing[:MAX_LISTED]}")
    return 0 if all(check.ok for check in checks) else 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except httpx.HTTPError as exc:
        print(f"verification aborted: {exc}", file=sys.stderr)
        sys.exit(2)
