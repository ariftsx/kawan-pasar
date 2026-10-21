from pathlib import Path

import pytest
from pydantic import ValidationError

from ingest.catalog import load_catalog


def test_default_catalog_is_the_three_model_commodities() -> None:
    catalog = load_catalog()
    assert [c.slug for c in catalog] == ["cabai-merah-keriting", "bawang-merah", "beras-medium-1"]
    assert {c.market for c in catalog} == {"PIKJ"}
    assert [c.comcat_id for c in catalog] == ["com_14", "com_11", "com_3"]


def write(tmp_path: Path, body: str) -> Path:
    path = tmp_path / "catalog.toml"
    path.write_text(body, encoding="utf-8")
    return path


ENTRY = """
[[commodity]]
slug = "bawang-merah"
pihps_name = "Bawang Merah Ukuran Sedang"
comcat_id = "com_11"
market = "PIKJ"
unit = "kg"
"""


def test_rejects_an_empty_catalog(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="kosong"):
        load_catalog(write(tmp_path, ""))


def test_rejects_duplicate_slugs(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="ganda"):
        load_catalog(write(tmp_path, ENTRY + ENTRY))


def test_rejects_unknown_markets_and_fields(tmp_path: Path) -> None:
    with pytest.raises(ValidationError):
        load_catalog(write(tmp_path, ENTRY.replace('"PIKJ"', '"JAKARTA"')))
    with pytest.raises(ValidationError):
        load_catalog(write(tmp_path, ENTRY + 'weight = "0.5"\n'))
    with pytest.raises(ValidationError):
        load_catalog(write(tmp_path, ENTRY.replace('"bawang-merah"', '"bawang--merah"')))
