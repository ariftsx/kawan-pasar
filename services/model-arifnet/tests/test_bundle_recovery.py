"""Recovery from interrupted runs and an unambiguous issue time."""

from __future__ import annotations

import shutil
from pathlib import Path

import pytest
from test_cli import prices_file

from kp_model.__main__ import main

NOW = "2026-11-19T03:00:00+00:00"


def test_now_must_carry_a_time_zone(tmp_path: Path) -> None:
    with pytest.raises(SystemExit):
        main(["--prices", str(prices_file(tmp_path)), "--out", str(tmp_path), "--now", "2026-11-19T03:00"])


def test_a_leftover_half_written_bundle_is_replaced(tmp_path: Path) -> None:
    out = tmp_path / "out"
    args = ["--prices", str(prices_file(tmp_path)), "--out", str(out), "--now", NOW]
    assert main(args) == 0
    finished = next(p for p in out.iterdir() if not p.name.startswith("."))
    shutil.rmtree(finished)
    stale = out / f".{finished.name}.tmp"
    stale.mkdir()
    (stale / "forecasts.csv").write_text("half", encoding="utf-8")
    assert main(args) == 0
    assert not stale.exists()
    assert (out / finished.name / "SHA256SUMS").exists()
