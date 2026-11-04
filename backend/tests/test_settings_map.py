"""Map location settings: validation and Google Maps link parsing."""

import pytest

from app.services.settings_service import parse_google_maps_link

P = "/api/v1"


# ---------- parse_google_maps_link ----------

@pytest.mark.parametrize("url,expected", [
    ("https://www.google.com/maps/place/Dubai/@25.2048,55.2708,15z", (25.2048, 55.2708)),
    ("https://maps.google.com/?q=25.2048,55.2708", (25.2048, 55.2708)),
    ("https://www.google.com/maps?q=25.2048,55.2708&z=15", (25.2048, 55.2708)),
    ("https://www.google.com/maps?ll=25.2048,55.2708", (25.2048, 55.2708)),
    ("https://www.google.com/maps/dir/?api=1&destination=25.2048,55.2708", (25.2048, 55.2708)),
    ("https://www.google.com/maps/search/?api=1&query=25.2048,55.2708", (25.2048, 55.2708)),
    ("https://www.google.com/maps/place/Shop/!3d25.2048!4d55.2708!5m1", (25.2048, 55.2708)),
    ("https://www.facebook.com/@25.2048,55.2708", None),  # not a maps host
    ("https://maps.app.goo.gl/xYz123", None),  # short link, no embedded coords
    ("https://www.google.com/maps/place/Somewhere", None),
])
def test_parse_google_maps_link(url: str, expected: tuple[float, float] | None) -> None:
    assert parse_google_maps_link(url) == expected


def test_parse_rejects_out_of_range_coords() -> None:
    assert parse_google_maps_link("https://www.google.com/maps?q=999,55.2708") is None


# ---------- settings validation via API ----------

def _put(client, auth, **values) -> dict:
    return client.put(f"{P}/admin/settings", json={"values": values}, headers=auth)


def test_map_settings_saved_and_public(client, auth) -> None:
    res = _put(client, auth, map_lat=25.32, map_lng=55.40, map_zoom=14, map_link="")
    assert res.status_code == 200, res.text
    pub = client.get(f"{P}/settings/public").json()
    assert (pub["map_lat"], pub["map_lng"], pub["map_zoom"]) == (25.32, 55.40, 14)


def test_map_link_extracts_coords(client, auth) -> None:
    res = _put(client, auth, map_link="https://www.google.com/maps?q=25.10,55.20")
    assert res.status_code == 200, res.text
    pub = client.get(f"{P}/settings/public").json()
    assert pub["map_lat"] == pytest.approx(25.10)
    assert pub["map_lng"] == pytest.approx(55.20)


@pytest.mark.parametrize("key,value", [
    ("map_lat", 95), ("map_lat", "abc"), ("map_lng", -200), ("map_zoom", 0), ("map_zoom", 25),
])
def test_map_settings_reject_out_of_range(client, auth, key: str, value) -> None:
    res = _put(client, auth, **{key: value})
    assert res.status_code == 422


def test_map_link_rejects_non_google(client, auth) -> None:
    assert _put(client, auth, map_link="https://evil.example.com/maps?q=1,2").status_code == 422
