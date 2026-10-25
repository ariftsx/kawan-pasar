from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.errors import ServiceError, register_error_handlers
from app.observability import request_context


def make_client() -> TestClient:
    app = FastAPI()
    app.middleware("http")(request_context)
    register_error_handlers(app)

    @app.get("/boom")
    async def boom() -> None:  # pyright: ignore[reportUnusedFunction]
        raise RuntimeError("db password=hunter2")

    @app.get("/gateway")
    async def gateway() -> None:  # pyright: ignore[reportUnusedFunction]
        raise HTTPException(status_code=502)

    @app.get("/forecast")
    async def forecast() -> None:  # pyright: ignore[reportUnusedFunction]
        raise ServiceError("FORECAST_UNAVAILABLE", "Perkiraan belum tersedia.")

    @app.get("/items/{item_id}")
    async def item(item_id: int) -> dict[str, int]:  # pyright: ignore[reportUnusedFunction]
        return {"item_id": item_id}

    return TestClient(app, raise_server_exceptions=False)


def test_unexpected_errors_hide_their_details() -> None:
    for path in ("/boom", "/gateway"):
        response = make_client().get(path)
        assert response.status_code == 500
        assert response.json()["error"]["code"] == "INTERNAL_ERROR"
        assert "hunter2" not in response.text


def test_service_errors_keep_their_contract_status() -> None:
    response = make_client().get("/forecast")
    assert response.status_code == 503
    assert response.json()["error"] == {
        "code": "FORECAST_UNAVAILABLE",
        "message": "Perkiraan belum tersedia.",
        "request_id": response.headers["x-request-id"],
    }


def test_invalid_parameters_do_not_echo_pydantic_details() -> None:
    response = make_client().get("/items/abc")
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_REQUEST"
    assert "abc" not in response.text
