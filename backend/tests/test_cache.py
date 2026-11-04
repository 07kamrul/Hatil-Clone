import time

import pytest

from app.core.cache import TTLCache, cache_key


@pytest.fixture(autouse=True)
def _reset_response_cache():
    from app.core.cache import response_cache

    response_cache.clear()
    yield
    response_cache.clear()


# ---------- TTLCache unit tests ----------

def test_get_returns_none_on_miss() -> None:
    cache = TTLCache(max_entries=10, ttl_seconds=60)
    assert cache.get("k") is None


def test_set_then_get_hits() -> None:
    cache = TTLCache(max_entries=10, ttl_seconds=60)
    cache.set("k", {"v": 1})
    assert cache.get("k") == {"v": 1}
    assert cache.hits == 1
    assert cache.misses == 0


def test_expired_entry_returns_none() -> None:
    cache = TTLCache(max_entries=10, ttl_seconds=0.01)
    cache.set("k", "v")
    time.sleep(0.02)
    assert cache.get("k") is None
    assert len(cache) == 0


def test_lru_eviction_drops_oldest() -> None:
    cache = TTLCache(max_entries=2, ttl_seconds=60)
    cache.set("a", 1)
    cache.set("b", 2)
    cache.set("c", 3)
    assert cache.get("a") is None
    assert cache.get("b") == 2
    assert cache.get("c") == 3
    assert len(cache) == 2


def test_clear_removes_all_entries() -> None:
    cache = TTLCache(max_entries=10, ttl_seconds=60)
    cache.set("a", 1)
    cache.set("b", 2)
    assert cache.clear() == 2
    assert len(cache) == 0
    assert cache.get("a") is None


def test_cache_key_uses_path_and_query() -> None:
    assert cache_key("/api/v1/products", b"page=2") == "/api/v1/products?page=2"
    assert cache_key("/api/v1/rooms", b"") == "/api/v1/rooms"


# ---------- API-level cache behavior ----------

def test_second_public_get_is_cache_hit(client) -> None:
    first = client.get("/api/v1/rooms")
    assert first.status_code == 200
    assert first.headers["X-Cache"] == "MISS"
    assert first.headers["Cache-Control"] == "public, max-age=60"
    second = client.get("/api/v1/rooms")
    assert second.headers["X-Cache"] == "HIT"
    assert second.json() == first.json()


def test_search_is_never_cached(client) -> None:
    client.get("/api/v1/search?q=sofa")
    res = client.get("/api/v1/search?q=sofa")
    assert res.headers["X-Cache"] == "BYPASS"


def test_admin_get_is_never_cached(client, auth: dict) -> None:
    client.get("/api/v1/admin/dashboard", headers=auth)
    res = client.get("/api/v1/admin/dashboard", headers=auth)
    assert "X-Cache" not in res.headers


def test_admin_write_invalidates_cache(client, auth: dict, make_category) -> None:
    before = client.get("/api/v1/categories/tree")
    assert before.headers["X-Cache"] == "MISS"
    assert client.get("/api/v1/categories/tree").headers["X-Cache"] == "HIT"

    make_category("Fresh Category")
    after = client.get("/api/v1/categories/tree")
    assert after.headers["X-Cache"] == "MISS"
    assert any(c["name"] == "Fresh Category" for c in after.json())


def test_cache_clear_endpoint(client, auth: dict) -> None:
    client.get("/api/v1/rooms")
    res = client.post("/api/v1/admin/cache/clear", headers=auth)
    assert res.status_code == 200
    assert client.get("/api/v1/rooms").headers["X-Cache"] == "MISS"


def test_cache_clear_endpoint_requires_auth(client) -> None:
    assert client.post("/api/v1/admin/cache/clear").status_code in (401, 403)
