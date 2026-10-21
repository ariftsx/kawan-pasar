"""Error envelope (docs 08 §8): stable codes, no stack traces in responses."""

from typing import Literal

import structlog
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

ErrorCode = Literal[
    "INVALID_REQUEST",
    "UNAUTHENTICATED",
    "NOT_FOUND",
    "ARTIFACT_NOT_FOUND",
    "SCHEMA_INVALID",
    "INTERNAL_ERROR",
    "FORECAST_UNAVAILABLE",
]

STATUS: dict[ErrorCode, int] = {
    "INVALID_REQUEST": 400,
    "UNAUTHENTICATED": 401,
    "NOT_FOUND": 404,
    "ARTIFACT_NOT_FOUND": 404,
    "SCHEMA_INVALID": 422,
    "INTERNAL_ERROR": 500,
    "FORECAST_UNAVAILABLE": 503,
}

log = structlog.get_logger()


class ServiceError(Exception):
    """A failure with a contract code whose message is safe to show to the caller."""

    def __init__(self, code: ErrorCode, message: str) -> None:
        super().__init__(message)
        self.code: ErrorCode = code
        self.message = message


def error_response(request: Request, code: ErrorCode, message: str) -> JSONResponse:
    request_id = str(getattr(request.state, "request_id", ""))
    body = {"data": None, "error": {"code": code, "message": message, "request_id": request_id}}
    return JSONResponse(body, status_code=STATUS[code], headers={"cache-control": "no-store"})


async def _service_error(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, ServiceError)  # noqa: S101 - registered for ServiceError only
    log.warning("request rejected", code=exc.code)
    return error_response(request, exc.code, exc.message)


async def _http_error(request: Request, exc: Exception) -> JSONResponse:
    status = exc.status_code if isinstance(exc, HTTPException) else 500
    if status == STATUS["NOT_FOUND"]:
        return error_response(request, "NOT_FOUND", "Sumber daya tidak ditemukan.")
    if status < STATUS["INTERNAL_ERROR"]:
        return error_response(request, "INVALID_REQUEST", "Permintaan tidak valid.")
    return await _unexpected(request, exc)


async def _validation_error(request: Request, _exc: Exception) -> JSONResponse:
    return error_response(request, "INVALID_REQUEST", "Permintaan tidak valid.")


async def _unexpected(request: Request, exc: Exception) -> JSONResponse:
    log.error("unhandled error", exc_info=exc)
    return error_response(request, "INTERNAL_ERROR", "Terjadi kesalahan pada server.")


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(ServiceError, _service_error)
    app.add_exception_handler(HTTPException, _http_error)
    app.add_exception_handler(RequestValidationError, _validation_error)
    app.add_exception_handler(Exception, _unexpected)
