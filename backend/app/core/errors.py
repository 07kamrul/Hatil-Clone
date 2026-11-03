import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

log = logging.getLogger("app.errors")


class AppError(Exception):
    status_code = 400

    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


class NotFoundError(AppError):
    status_code = 404


class ConflictError(AppError):
    status_code = 409


class AuthError(AppError):
    status_code = 401


class ForbiddenError(AppError):
    status_code = 403


class ValidationAppError(AppError):
    status_code = 422


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError) -> JSONResponse:
        headers = {"WWW-Authenticate": "Bearer"} if exc.status_code == 401 else None
        return JSONResponse({"detail": exc.detail}, status_code=exc.status_code, headers=headers)

    @app.exception_handler(IntegrityError)
    async def _integrity(_: Request, exc: IntegrityError) -> JSONResponse:
        log.warning("Integrity error: %s", exc.orig)
        return JSONResponse({"detail": "A record with the same unique value already exists"}, status_code=409)

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
        log.exception("Unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse({"detail": "Internal server error"}, status_code=500)
