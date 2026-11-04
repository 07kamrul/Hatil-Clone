from decimal import Decimal

import httpx
import pytest

from scripts.verify_import import count_nodes, description_close, get_json, parse_report, price_matches

REPORT = """# Scrape report 20261104-010101-abcd

- Mode: `all`
- URLs discovered: 948
- Attempted: 948
- Created: 800
- Updated: 100
- Failed: 20
- Skipped (robots.txt / discontinued / no price): 15
- Gone (HTTP 404/410): 13
"""


def test_parse_report_reads_run_counts() -> None:
    counts = parse_report(REPORT)

    assert counts == {"discovered": 948, "attempted": 948, "created": 800, "updated": 100,
                      "failed": 20, "skipped": 15, "gone": 13}


def test_parse_report_ignores_missing_lines() -> None:
    assert parse_report("# empty report") == {}


def test_count_nodes_counts_nested_categories() -> None:
    tree = [{"slug": "a", "children": [{"slug": "b", "children": []}, {"slug": "c", "children": [{"slug": "d"}]}]},
            {"slug": "e"}]

    assert count_nodes(tree) == 5


def test_price_matches_compares_regular_and_sale_price() -> None:
    assert price_matches(40000.0, 34600.0, Decimal("40000.00"), Decimal("34600.00"))
    assert price_matches(165200.0, None, Decimal("165200.00"), None)
    assert not price_matches(165200.0, None, Decimal("160000.00"), None)
    assert not price_matches(40000.0, 34600.0, Decimal("40000.00"), None)


def test_description_close_tolerates_sanitising_but_not_truncation() -> None:
    live = "<p>" + "Beech wood frame with lacquer finish. " * 10 + "</p>"

    assert description_close("<div>" + "Beech wood frame with lacquer finish. " * 10 + "</div>", live)
    assert not description_close("<p>Beech wood.</p>", live)
    assert not description_close(None, live)
    assert description_close(None, None)


def _client(statuses: list[int], retry_after: str | None = None) -> tuple[httpx.Client, list[int]]:
    served: list[int] = []

    def handler(_request: httpx.Request) -> httpx.Response:
        status = statuses[len(served)] if len(served) < len(statuses) else 200
        served.append(status)
        headers = {"Retry-After": retry_after} if retry_after and status == 429 else {}
        return httpx.Response(status, json={"ok": True}, headers=headers)

    return httpx.Client(transport=httpx.MockTransport(handler)), served


def test_get_json_retries_when_rate_limited() -> None:
    client, served = _client([429, 429, 200], retry_after="3")
    sleeps: list[float] = []

    assert get_json(client, "http://api/x", sleep=sleeps.append) == {"ok": True}
    assert served == [429, 429, 200] and sleeps == [3, 3]


def test_get_json_gives_up_after_repeated_rate_limiting() -> None:
    client, _ = _client([429] * 10)

    with pytest.raises(httpx.HTTPStatusError):
        get_json(client, "http://api/x", sleep=lambda _s: None)


def test_check_content_flags_remote_images() -> None:
    import httpx as _httpx

    from scripts.verify_import import check_content

    def handler(request: _httpx.Request) -> _httpx.Response:
        path = request.url.path
        if path.endswith("/banners"):
            return _httpx.Response(200, json=[{"title": "Hero", "image": "/uploads/banners/a.webp"},
                                              {"title": "Bad", "image": "https://hatil.com/remote.jpg"}])
        if path.endswith("/showrooms"):
            return _httpx.Response(200, json=[{"name": "S", "image": None}])
        if path.endswith("/faqs"):
            return _httpx.Response(200, json=[])
        return _httpx.Response(200, json={"items": [{"slug": "p", "cover_image": "/uploads/blog/c.webp"}]})

    with _httpx.Client(transport=_httpx.MockTransport(handler)) as client:
        checks = check_content(client, "http://api/api/v1", "http://api")

    by_name = {c.name: c for c in checks}
    assert by_name["content banners"].ok and by_name["content showrooms"].ok
    assert not by_name["content faqs"].ok  # empty means nothing imported
    assert not by_name["content images local"].ok  # the hatil.com URL is flagged
    assert "hatil.com/remote.jpg" in by_name["content images local"].detail
