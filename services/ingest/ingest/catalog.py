"""Loads the commodity list from configuration (docs 13 §A5: config, not code)."""

import tomllib
from pathlib import Path

from pydantic import TypeAdapter

from ingest.models import Commodity

DEFAULT_CATALOG = Path(__file__).with_name("commodities.toml")

_COMMODITIES = TypeAdapter(tuple[Commodity, ...])


def load_catalog(path: Path = DEFAULT_CATALOG) -> tuple[Commodity, ...]:
    with path.open("rb") as file:
        raw = tomllib.load(file)
    commodities = _COMMODITIES.validate_python(raw.get("commodity", []))
    if not commodities:
        raise ValueError("katalog komoditas kosong")
    slugs = [commodity.slug for commodity in commodities]
    if len(set(slugs)) != len(slugs):
        raise ValueError("slug komoditas ganda di katalog")
    return commodities
