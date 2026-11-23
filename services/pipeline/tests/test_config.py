"""Task 2: each run's project.json = ARIF-Net's frozen research settings + our commodities and data end."""

import json
from datetime import date
from pathlib import Path

import pytest

from kp_pipeline.config import Commodity, ConfigError, load_commodities, write_project
from kp_pipeline.vendor import stage

FIVE = [
    Commodity("com_14", "cabai-merah-keriting", "Cabai Merah Keriting", "Cabai Merah Keriting"),
    Commodity("com_11", "bawang-merah", "Bawang Merah Ukuran Sedang", "Bawang Merah Ukuran Sedang"),
    Commodity("com_3", "beras-medium-1", "Beras Kualitas Medium I", "Beras Kualitas Medium I"),
    Commodity("com_99", "cabai-rawit-hijau", "Cabai Rawit Hijau", "Cabai Rawit Hijau"),
    Commodity("com_98", "cabai-rawit-merah", "Cabai Rawit Merah", "Cabai Rawit Merah"),
]


def test_only_commodities_and_the_data_end_change(tmp_path: Path) -> None:
    staged = stage(tmp_path / "run")
    base = json.loads((staged / "configs" / "project.json").read_text(encoding="utf-8"))
    write_project(staged, FIVE, date(2026, 9, 30))
    project = json.loads((staged / "configs" / "project.json").read_text(encoding="utf-8"))
    assert [c["comcat_id"] for c in project["commodities"]] == [c.comcat_id for c in FIVE]
    assert project["commodities"][3] == {
        "comcat_id": "com_99",
        "name": "Cabai Rawit Hijau",
        "pihps_name": "Cabai Rawit Hijau",
    }
    assert project["period"] == {"start": base["period"]["start"], "end": "2026-09-30"}
    assert project["data_end"] == "2026-09-30"
    assert project["prospective"]["train_end"] == "2026-09-30"
    # Frozen research settings are untouched.
    for key in ("horizons", "target", "validation", "availability", "training"):
        assert project[key] == base[key], key


def test_the_data_end_follows_the_lock_after_opening(tmp_path: Path) -> None:
    staged = stage(tmp_path / "run")
    write_project(staged, FIVE, date(2026, 12, 19))
    project = json.loads((staged / "configs" / "project.json").read_text(encoding="utf-8"))
    assert (project["data_end"], project["prospective"]["train_end"]) == ("2026-12-19", "2026-12-19")


def test_refuses_a_data_end_before_the_history_starts(tmp_path: Path) -> None:
    staged = stage(tmp_path / "run")
    with pytest.raises(ConfigError, match="before"):
        write_project(staged, FIVE, date(2018, 12, 31))


def test_commodities_come_from_the_pipeline_catalog_mirror() -> None:
    commodities = load_commodities()
    assert [c.code for c in commodities][:3] == ["cabai-merah-keriting", "bawang-merah", "beras-medium-1"]
    assert all(c.comcat_id.startswith("com_") for c in commodities)
