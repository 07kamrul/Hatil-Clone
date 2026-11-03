"""Polite HTTP client: robots.txt, per-host throttling, retries with exponential backoff."""

import logging
import random
import time
from urllib.parse import urlsplit

import httpx

from scraper.config import ScraperConfig
from scraper.robots import RobotsRules

log = logging.getLogger("scraper.http")

RETRY_STATUSES = {429, 500, 502, 503, 504}


class RobotsDisallowedError(Exception):
    pass


class FetchError(Exception):
    pass


class PoliteClient:
    def __init__(self, config: ScraperConfig, client: httpx.Client | None = None, sleep=time.sleep) -> None:  # noqa: ANN001
        self.config = config
        self.client = client or httpx.Client(
            headers={"User-Agent": config.user_agent, "Accept-Language": "en"},
            timeout=config.timeout, follow_redirects=True,
        )
        self._sleep = sleep
        self._last_request: dict[str, float] = {}
        self._robots: dict[str, RobotsRules | None] = {}
        self.request_count = 0

    def close(self) -> None:
        self.client.close()

    # ---------- robots ----------
    def allowed(self, url: str) -> bool:
        parts = urlsplit(url)
        host = f"{parts.scheme}://{parts.netloc}"
        if host not in self._robots:
            self._robots[host] = self._load_robots(host)
        parser = self._robots[host]
        return True if parser is None else parser.can_fetch(self.config.user_agent, url)

    def _load_robots(self, host: str) -> RobotsRules | None:
        """Parse robots.txt when served. Asset hosts (e.g. S3 buckets) without one are treated as unrestricted."""
        try:
            res = self._request("GET", f"{host}/robots.txt", check_robots=False, retries=1)
        except FetchError:
            return None
        if res.status_code != 200:
            return None
        return RobotsRules.parse(res.text)

    # ---------- fetching ----------
    def get_text(self, url: str) -> str:
        return self._request("GET", url).text

    def get_bytes(self, url: str) -> bytes:
        res = self._request("GET", url)
        if len(res.content) > self.config.max_image_bytes:
            raise FetchError(f"{url} exceeds {self.config.max_image_bytes} bytes")
        return res.content

    def _throttle(self, host: str) -> None:
        elapsed = time.monotonic() - self._last_request.get(host, 0.0)
        wait = self.config.min_interval - elapsed
        if wait > 0:
            self._sleep(wait)
        self._last_request[host] = time.monotonic()

    def _request(self, method: str, url: str, check_robots: bool = True, retries: int | None = None) -> httpx.Response:
        if check_robots and not self.allowed(url):
            raise RobotsDisallowedError(f"robots.txt disallows {url}")
        host = urlsplit(url).netloc
        attempts = (retries if retries is not None else self.config.max_retries) + 1
        last_error: str = ""
        for attempt in range(1, attempts + 1):
            self._throttle(host)
            self.request_count += 1
            try:
                res = self.client.request(method, url)
            except httpx.HTTPError as exc:
                last_error = f"{type(exc).__name__}: {exc}"
            else:
                if res.status_code < 400:
                    return res
                if res.status_code not in RETRY_STATUSES:
                    raise FetchError(f"HTTP {res.status_code} for {url}")
                last_error = f"HTTP {res.status_code}"
                retry_after = res.headers.get("Retry-After")
                if retry_after and retry_after.isdigit():
                    self._sleep(min(int(retry_after), 120))
                    continue
            if attempt < attempts:
                delay = self.config.backoff_base ** attempt + random.uniform(0, 0.5)  # noqa: S311
                log.info("Retry %s/%s for %s in %.1fs (%s)", attempt, attempts - 1, url, delay, last_error)
                self._sleep(delay)
        raise FetchError(f"Giving up on {url}: {last_error}")


def render_with_playwright(url: str, user_agent: str, timeout_ms: int = 30000) -> str | None:
    """Fallback for pages whose data only appears after JavaScript runs. Returns None if Playwright is missing."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        log.debug("Playwright not installed; skipping JS rendering for %s", url)
        return None
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        try:
            page = browser.new_page(user_agent=user_agent)
            page.goto(url, wait_until="networkidle", timeout=timeout_ms)
            return page.content()
        finally:
            browser.close()
