import httpx
import pytest
from pytest import MonkeyPatch

from app.api.v1.admin.maps import parse_coords


def test_parse_coords_from_url_patterns() -> None:
    assert parse_coords("https://www.google.com/maps/@25.3216,55.4018,15z") == (25.3216, 55.4018)
    assert parse_coords("https://maps.google.com/?q=23.79,90.41") == (23.79, 90.41)
    assert parse_coords("https://www.google.com/maps/place/x/!3d25.30!4d55.40") == (25.30, 55.40)


def test_parse_coords_rejects_out_of_range_and_empty() -> None:
    assert parse_coords("https://maps.app.goo.gl/AbCdEf") is None
    assert parse_coords("https://www.google.com/maps/@200,55.0,15z") is None


def test_resolve_requires_admin(client) -> None:
    assert client.get("/api/v1/admin/maps/resolve", params={"url": "https://goo.gl/x"}).status_code in (401, 403)


def test_resolve_rejects_non_google_hosts(client, auth: dict) -> None:
    res = client.get("/api/v1/admin/maps/resolve", params={"url": "https://evil.example.com/@1,2"}, headers=auth)
    assert res.status_code == 422


def test_resolve_follows_short_link(client, auth: dict, monkeypatch: MonkeyPatch) -> None:
    class FakeResponse:
        url = "https://www.google.com/maps/place/Foo/@25.3216,55.4018,15z"
        text = ""

        def raise_for_status(self) -> None: ...

    class FakeClient:
        def __init__(self, *args: object, **kwargs: object) -> None: ...

        def __enter__(self) -> "FakeClient":
            return self

        def __exit__(self, *args: object) -> None: ...

        def get(self, url: str) -> FakeResponse:
            assert url == "https://maps.app.goo.gl/AbCdEf"
            return FakeResponse()

    monkeypatch.setattr(httpx, "Client", FakeClient)
    res = client.get("/api/v1/admin/maps/resolve", params={"url": "https://maps.app.goo.gl/AbCdEf"}, headers=auth)
    assert res.status_code == 200
    assert res.json() == {"latitude": 25.3216, "longitude": 55.4018}


def test_resolve_reports_missing_coords(client, auth: dict, monkeypatch: MonkeyPatch) -> None:
    class FakeResponse:
        url = "https://maps.app.goo.gl/AbCdEf"
        text = "<html>no coords here</html>"

        def raise_for_status(self) -> None: ...

    class FakeClient:
        def __init__(self, *args: object, **kwargs: object) -> None: ...

        def __enter__(self) -> "FakeClient":
            return self

        def __exit__(self, *args: object) -> None: ...

        def get(self, url: str) -> FakeResponse:
            return FakeResponse()

    monkeypatch.setattr(httpx, "Client", FakeClient)
    res = client.get("/api/v1/admin/maps/resolve", params={"url": "https://maps.app.goo.gl/AbCdEf"}, headers=auth)
    assert res.status_code == 422


@pytest.mark.parametrize("url", ["http://goo.gl/x", "ftp://goo.gl/x"])
def test_resolve_requires_https(client, auth: dict, url: str) -> None:
    assert client.get("/api/v1/admin/maps/resolve", params={"url": url}, headers=auth).status_code == 422
