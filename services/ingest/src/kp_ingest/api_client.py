"""Tells the Core API that price data changed, so its cache can be invalidated right away."""

import json
import logging
import urllib.error
import urllib.request
from urllib.parse import urlsplit

log = logging.getLogger("kp_ingest")

TIMEOUT_S = 3


def invalidate_price_cache(api_url: str, service_token: str) -> bool:
    """Best effort: returns False (and logs) on any failure. Cached prices then expire by TTL."""
    target = f"{api_url.rstrip('/')}/internal/cache/invalidate"
    if urlsplit(target).scheme not in {"http", "https"}:
        log.warning("cache invalidation skipped: API_INTERNAL_URL must be http(s)")
        return False
    request = urllib.request.Request(  # noqa: S310 - scheme checked above
        target,
        data=json.dumps({"scope": "prices"}).encode(),
        headers={"Content-Type": "application/json", "x-service-token": service_token},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_S) as response:  # noqa: S310
            return bool(200 <= response.status < 300)
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        # The token is in the request headers only; the error text never contains it.
        log.warning("cache invalidation failed: %s", type(error).__name__)
        return False
