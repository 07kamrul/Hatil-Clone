import logging
import re
from pathlib import Path

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded

from app.api.v1 import auth, public
from app.api.v1.admin import router as admin_router
from app.core.cache import cache_key, response_cache
from app.core.config import get_settings
from app.core.errors import register_error_handlers
from app.core.rate_limit import limiter
from app.storage.base import InvalidImageError

API_PREFIX = "/api/v1"

# High-cardinality or per-cart endpoints: no reuse, never cached.
CACHE_EXCLUDED_SUFFIXES = ("/search", "/products/by-ids", "/products/compare")
# Product detail counts views in the DB on each hit; caching it would break that count.
CACHE_EXCLUDED_VIEW_COUNTED = re.compile(r"^/api/v1/products/[^/]+$")
CACHEABLE_BROADCAST_HEADER = "public, max-age=60"

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Cross-Origin-Opener-Policy": "same-origin",
}
API_CSP = "default-src 'none'; frame-ancestors 'none'"


def create_app() -> FastAPI:
    settings = get_settings()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    app = FastAPI(
        title="Furniture Catalog API",
        version="1.0.0",
        description="Public catalog + admin API. Orders are placed on WhatsApp; no customer accounts.",
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
    )
    app.state.limiter = limiter
    register_error_handlers(app)

    @app.exception_handler(RateLimitExceeded)
    async def _rate_limited(_: Request, exc: RateLimitExceeded) -> JSONResponse:
        return JSONResponse({"detail": f"Too many requests: {exc.detail}"}, status_code=429)

    @app.exception_handler(InvalidImageError)
    async def _bad_image(_: Request, exc: InvalidImageError) -> JSONResponse:
        return JSONResponse({"detail": str(exc)}, status_code=422)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )

    def _is_cache_scope(path: str) -> tuple[bool, bool, bool]:
        """(in_api, cacheable, public_but_excluded): cacheable = public GET not excluded."""
        in_api = path.startswith(API_PREFIX)
        is_private = path.startswith(f"{API_PREFIX}/admin") or path.startswith(f"{API_PREFIX}/auth")
        excluded = (any(path.endswith(suffix) for suffix in CACHE_EXCLUDED_SUFFIXES)
                    or CACHE_EXCLUDED_VIEW_COUNTED.fullmatch(path) is not None)
        return in_api, in_api and not is_private and not excluded, in_api and not is_private and excluded

    @app.middleware("http")
    async def _response_cache(request: Request, call_next) -> Response:  # noqa: ANN001
        method = request.method
        path = request.url.path
        in_api, cacheable, excluded_public = _is_cache_scope(path)

        if settings.cache_enabled and cacheable and method == "GET":
            key = cache_key(path, request.scope.get("query_string", b""))
            cached = response_cache.get(key)
            if cached is not None:
                status_code, headers, body = cached
                response = Response(content=body, status_code=status_code, headers=headers)
                response.headers["X-Cache"] = "HIT"
                return response

        response: Response = await call_next(request)

        if settings.cache_enabled:
            if cacheable and method == "GET":
                response.headers.setdefault("Cache-Control", CACHEABLE_BROADCAST_HEADER)
                if response.status_code == 200:
                    body = b""
                    async for chunk in response.body_iterator:  # type: ignore[attr-defined]
                        body += chunk
                    headers = {k: v for k, v in response.headers.items() if k.lower() != "content-length"}
                    response_cache.set(key, (response.status_code, headers, body))
                    response = Response(content=body, status_code=response.status_code, headers=headers)
                    response.headers["X-Cache"] = "MISS"
                else:
                    response.headers["X-Cache"] = "BYPASS"
            elif settings.cache_enabled and in_api and excluded_public and method == "GET":
                response.headers["X-Cache"] = "BYPASS"
            elif in_api and method != "GET" and response.status_code < 300:
                # Any successful admin/auth write drops the whole cache (single-process app).
                response_cache.clear()
        return response

    @app.middleware("http")
    async def _security_headers(request: Request, call_next) -> Response:  # noqa: ANN001
        response: Response = await call_next(request)
        for name, value in SECURITY_HEADERS.items():
            response.headers.setdefault(name, value)
        if request.url.path.startswith(API_PREFIX) and not request.url.path.startswith("/api/docs"):
            response.headers.setdefault("Content-Security-Policy", API_CSP)
        if settings.is_production:
            response.headers.setdefault("Strict-Transport-Security", "max-age=63072000; includeSubDomains")
        return response

    @app.get(f"{API_PREFIX}/health", tags=["health"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(auth.router, prefix=API_PREFIX)
    app.include_router(admin_router, prefix=API_PREFIX)
    app.include_router(public.router, prefix=API_PREFIX)

    if settings.storage_backend == "local":
        # In Docker nginx serves /uploads directly; this mount covers local development.
        upload_dir = Path(settings.upload_dir)
        upload_dir.mkdir(parents=True, exist_ok=True)
        app.mount(settings.upload_url_prefix, StaticFiles(directory=upload_dir), name="uploads")
    return app


app = create_app()
