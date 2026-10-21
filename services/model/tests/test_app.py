from fastapi.testclient import TestClient


def test_probes_answer_without_a_signature(client: TestClient) -> None:
    assert client.get("/healthz").json() == {"status": "ok"}
    ready = client.get("/readyz")
    # Development mode serves the packaged DATA DEMO bundle (docs 08 §12.5).
    assert ready.json() == {"status": "ok", "outlook": "in_development"}
    assert ready.headers["cache-control"] == "no-store"


def test_keeps_a_safe_request_id_and_mints_one_otherwise(client: TestClient) -> None:
    assert (
        client.get("/healthz", headers={"x-request-id": "req_abc"}).headers["x-request-id"]
        == "req_abc"
    )
    minted = client.get("/healthz", headers={"x-request-id": "bad id\n"}).headers["x-request-id"]
    assert minted.startswith("req_")
    assert minted != "bad id\n"


def test_unknown_routes_use_the_error_envelope(client: TestClient) -> None:
    response = client.get("/internal/nope", headers={"x-request-id": "req_xyz"})
    assert response.status_code == 404
    assert response.json() == {
        "data": None,
        "error": {
            "code": "NOT_FOUND",
            "message": "Sumber daya tidak ditemukan.",
            "request_id": "req_xyz",
        },
    }


def test_wrong_method_is_a_plain_invalid_request(client: TestClient) -> None:
    response = client.post("/healthz")
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_REQUEST"


def test_has_no_public_docs(client: TestClient) -> None:
    for path in ("/docs", "/redoc", "/openapi.json"):
        assert client.get(path).status_code == 404
