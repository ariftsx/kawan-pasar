from fastapi import APIRouter, Depends, FastAPI
from fastapi.testclient import TestClient

from app.core.security import sign, signature_verifier
from app.errors import register_error_handlers
from app.observability import request_context

SECRET = b"s" * 32
NOW = 1_800_000_000


def make_client() -> TestClient:
    app = FastAPI()
    app.middleware("http")(request_context)
    register_error_handlers(app)
    router = APIRouter(dependencies=[Depends(signature_verifier(SECRET, 60, clock=lambda: NOW))])

    @router.post("/internal/echo")
    async def echo() -> dict[str, str]:  # pyright: ignore[reportUnusedFunction]
        return {"status": "ok"}

    app.include_router(router)
    return TestClient(app)


def signed(timestamp: int, path: str = "/internal/echo", body: bytes = b"{}") -> dict[str, str]:
    signature = sign(SECRET, str(timestamp), "POST", path, body)
    return {"x-kp-timestamp": str(timestamp), "x-kp-signature": signature}


def test_accepts_a_fresh_signature() -> None:
    response = make_client().post(
        "/internal/echo?x=1", content=b"{}", headers=signed(NOW, "/internal/echo?x=1")
    )
    assert response.status_code == 200


def test_tolerates_clock_skew_inside_the_window() -> None:
    response = make_client().post("/internal/echo", content=b"{}", headers=signed(NOW - 60))
    assert response.status_code == 200


def rejected(headers: dict[str, str], body: bytes = b"{}", path: str = "/internal/echo") -> None:
    response = make_client().post(path, content=body, headers=headers)
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHENTICATED"
    assert response.json()["error"]["request_id"].startswith("req_")


def test_rejects_missing_headers() -> None:
    rejected({})


def test_rejects_a_stale_or_future_timestamp() -> None:
    rejected(signed(NOW - 61))
    rejected(signed(NOW + 61))


def test_rejects_a_tampered_body() -> None:
    rejected(signed(NOW), body=b'{"x":1}')


def test_rejects_a_signature_replayed_on_another_route() -> None:
    rejected(signed(NOW, "/internal/other"))


def test_rejects_a_wrong_secret() -> None:
    headers = {
        "x-kp-timestamp": str(NOW),
        "x-kp-signature": sign(b"w" * 32, str(NOW), "POST", "/internal/echo", b"{}"),
    }
    rejected(headers)
