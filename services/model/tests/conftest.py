from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app

SECRET = "test-hmac-secret-0123456789abcdef"


@pytest.fixture
def settings() -> Settings:
    return Settings(model_hmac_secret=SECRET)  # pyright: ignore[reportArgumentType]


@pytest.fixture
def client(settings: Settings) -> Iterator[TestClient]:
    # The context manager runs the lifespan, which loads the bundle into app.state.
    with TestClient(create_app(settings), raise_server_exceptions=False) as test_client:
        yield test_client
