"""Where the pipeline's own files are: the repository's services/pipeline, or KP_PIPELINE_HOME (image)."""

import os
from pathlib import Path

_SOURCE_HOME = Path(__file__).resolve().parents[2]


def home() -> Path:
    """services/pipeline in the repository; /app in the image (set by the Dockerfile)."""
    env = os.environ.get("KP_PIPELINE_HOME")
    return Path(env) if env else _SOURCE_HOME


def vendor_dir() -> Path:
    return home() / "vendor" / "arifnet"


def prospective_dir() -> Path:
    return home() / "config" / "prospective"


def commodities_file() -> Path:
    return home() / "config" / "commodities.json"


def product_calendar() -> Path:
    """The product's holiday calendar (research holidays + flagged 2027 estimates, ruling K1)."""
    env = os.environ.get("KP_PRODUCT_CALENDAR")
    if env:
        return Path(env)
    return _SOURCE_HOME.parent / "model-arifnet" / "model" / "calendar_holidays.json"
