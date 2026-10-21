import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_reads_the_environment_with_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MODEL_HMAC_SECRET", "x" * 32)
    settings = Settings()  # pyright: ignore[reportCallIssue]
    assert settings.outlook_mode == "development"
    assert settings.hmac_max_skew_seconds == 60
    assert settings.model_hmac_secret.get_secret_value() == "x" * 32


def test_fails_fast_without_hiding_which_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MODEL_HMAC_SECRET", "too-short")
    monkeypatch.setenv("OUTLOOK_MODE", "latest")
    with pytest.raises(ValidationError) as caught:
        Settings()  # pyright: ignore[reportCallIssue]
    fields = {error["loc"][0] for error in caught.value.errors()}
    assert fields == {"model_hmac_secret", "outlook_mode"}
    assert "too-short" not in str(caught.value)
