"""Service settings (docs 13 §B2). The only module that reads the environment."""

from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # hide_input_in_errors: a failed boot must never print the secret it rejected.
    model_config = SettingsConfigDict(extra="ignore", frozen=True, hide_input_in_errors=True)

    # Shared with apps/api only; rotated every 90 days (docs 15 §6).
    model_hmac_secret: SecretStr = Field(min_length=32)
    # `development` serves the labelled demo bundle (docs 08 §12.5, DH-03).
    outlook_mode: Literal["development", "live"] = "development"
    # Read-only volume that holds `current/` (docs 13 §B3).
    artifacts_dir: Path = Path("/artifacts")
    hmac_max_skew_seconds: int = Field(default=60, ge=1, le=300)
    log_level: Literal["debug", "info", "warning", "error"] = "info"
