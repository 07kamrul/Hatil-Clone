"""Resolve a Google Maps link (including short goo.gl links) to coordinates.

Short links need a server-side redirect follow because the browser cannot
read the cross-origin redirect chain. Only Google Maps hosts are followed
to keep the endpoint from being used as an SSRF proxy.
"""

import re
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

router = APIRouter(tags=["system"])

TIMEOUT = httpx.Timeout(10.0)
MAX_BODY_BYTES = 200_000

# Mirrors the patterns in frontend/src/app/core/maps-link.ts.
AT_COORDS = re.compile(r"@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)")
QUERY_COORDS = re.compile(r"[?&](?:q|ll|query|destination)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)")
PLACE_COORDS = re.compile(r"!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)")
PATTERNS = (AT_COORDS, QUERY_COORDS, PLACE_COORDS)


def _is_maps_host(url: str) -> bool:
    host = urlparse(url).hostname or ""
    return host == "goo.gl" or host.endswith(".goo.gl") or host == "google.com" or host.endswith(".google.com")


def parse_coords(text: str) -> tuple[float, float] | None:
    """Extract (lat, lng) from a Maps URL or page fragment, or None."""
    for pattern in PATTERNS:
        match = pattern.search(text)
        if match:
            lat, lng = float(match.group(1)), float(match.group(2))
            if -90 <= lat <= 90 and -180 <= lng <= 180:
                return lat, lng
    return None


class MapsPoint(BaseModel):
    latitude: float
    longitude: float


@router.get("/maps/resolve", response_model=MapsPoint)
def resolve_maps_link(url: str = Query(min_length=1, max_length=2048)) -> MapsPoint:
    if not url.startswith("https://") or not _is_maps_host(url):
        raise HTTPException(status_code=422, detail="Only Google Maps links are supported.")
    direct = parse_coords(url)
    if direct:
        return MapsPoint(latitude=direct[0], longitude=direct[1])
    try:
        with httpx.Client(timeout=TIMEOUT, follow_redirects=True, max_redirects=10) as client:
            response = client.get(url)
            response.raise_for_status()
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Could not reach Google Maps to resolve the link.") from None
    found = parse_coords(str(response.url)) or parse_coords(response.text[:MAX_BODY_BYTES])
    if not found:
        raise HTTPException(status_code=422, detail="No coordinates found in that link — enter them manually.")
    return MapsPoint(latitude=found[0], longitude=found[1])
