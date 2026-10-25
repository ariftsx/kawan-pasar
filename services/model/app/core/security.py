"""HMAC request signing between apps/api and model-svc (docs 08 §7, docs 15 §6).

The signed string binds the timestamp, method, path with query, and body hash, so a captured
signature cannot be replayed against another route or after the skew window.
"""

import hashlib
import hmac
import time
from collections.abc import Callable

from fastapi import Request

from app.errors import ServiceError

TIMESTAMP_HEADER = "x-kp-timestamp"
SIGNATURE_HEADER = "x-kp-signature"


def canonical_string(timestamp: str, method: str, path: str, body: bytes) -> bytes:
    body_hash = hashlib.sha256(body).hexdigest()
    return f"{timestamp}\n{method.upper()}\n{path}\n{body_hash}".encode()


def sign(secret: bytes, timestamp: str, method: str, path: str, body: bytes) -> str:
    return hmac.new(secret, canonical_string(timestamp, method, path, body), "sha256").hexdigest()


def _target(request: Request) -> str:
    query = request.url.query
    return f"{request.url.path}?{query}" if query else request.url.path


def signature_verifier(
    secret: bytes, max_skew_seconds: int, clock: Callable[[], float] = time.time
) -> Callable[[Request], object]:
    """Builds the FastAPI dependency that fails closed on any missing or wrong part."""

    async def verify(request: Request) -> None:
        timestamp = request.headers.get(TIMESTAMP_HEADER, "")
        signature = request.headers.get(SIGNATURE_HEADER, "")
        if not timestamp.isdigit() or abs(clock() - int(timestamp)) > max_skew_seconds:
            raise ServiceError("UNAUTHENTICATED", "Tanda tangan kedaluwarsa atau tidak ada.")
        expected = sign(secret, timestamp, request.method, _target(request), await request.body())
        if not hmac.compare_digest(signature.encode(), expected.encode()):
            raise ServiceError("UNAUTHENTICATED", "Tanda tangan tidak valid.")

    return verify
