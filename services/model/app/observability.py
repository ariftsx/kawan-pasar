"""structlog JSON logs (docs 13 §B2) and X-Request-Id propagation (docs 08 §2)."""

import logging
import re
import uuid
from collections.abc import Awaitable, Callable

import structlog
from fastapi import Request, Response

REQUEST_ID_HEADER = "x-request-id"
# Accept the caller's id only when it is short and log-safe; the same rule as apps/api.
_SAFE_REQUEST_ID = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


def configure_logging(level: str) -> None:
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso", utc=True),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            logging.getLevelNamesMapping()[level.upper()]
        ),
        cache_logger_on_first_use=True,
    )


def resolve_request_id(incoming: str | None) -> str:
    if incoming is not None and _SAFE_REQUEST_ID.fullmatch(incoming):
        return incoming
    return f"req_{uuid.uuid4().hex}"


async def request_context(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    """Binds the request id to every log line of the request and echoes it back."""
    request_id = resolve_request_id(request.headers.get(REQUEST_ID_HEADER))
    request.state.request_id = request_id
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(request_id=request_id, route=request.url.path)
    response = await call_next(request)
    response.headers[REQUEST_ID_HEADER] = request_id
    return response
