"""The kp-pipeline command line."""

import json
from pathlib import Path

import pytest

from kp_pipeline.__main__ import main


def test_status_reports_the_lock(capsys: pytest.CaptureFixture[str]) -> None:
    assert main(["status"]) == 0
    state = json.loads(capsys.readouterr().out)
    assert state["open"] is False
    assert state["data_ceiling"] == "2026-09-30"


def test_unknown_steps_are_refused(capsys: pytest.CaptureFixture[str], tmp_path: Path) -> None:
    code = main(["run", "--store", str(tmp_path / "s"), "--runs", str(tmp_path / "r"), "--steps", "deploy"])
    assert code == 2
    assert "unknown steps" in capsys.readouterr().err


def test_run_prepare_only_prints_the_run_summary(capsys: pytest.CaptureFixture[str], tmp_path: Path) -> None:
    code = main(
        [
            "run",
            "--store",
            str(tmp_path / "s"),
            "--runs",
            str(tmp_path / "r"),
            "--run-id",
            "c1",
            "--steps",
            "prepare",
        ]
    )
    assert code == 0
    summary = json.loads(capsys.readouterr().out)
    assert summary["run_id"] == "c1"
    assert summary["data_end"] == "2026-09-30"
    assert summary["lock"]["open"] is False


def test_a_failing_step_exits_1_and_says_which(capsys: pytest.CaptureFixture[str], tmp_path: Path) -> None:
    # `prices` before `preprocess`: ARIF-Net's prices_combined.csv does not exist yet.
    code = main(
        ["run", "--store", str(tmp_path / "s"), "--runs", str(tmp_path / "r"), "--steps", "prepare,prices"]
    )
    assert code == 1
    assert "prices_combined.csv" in capsys.readouterr().err


def test_seed_copies_up_to_the_ceiling(capsys: pytest.CaptureFixture[str], tmp_path: Path) -> None:
    (tmp_path / "arif" / "data" / "raw" / "pihps").mkdir(parents=True)
    assert main(["seed", "--arifnet", str(tmp_path / "arif"), "--store", str(tmp_path / "store")]) == 0
    assert json.loads(capsys.readouterr().out) == {"copied_chunks": 0, "ceiling": "2026-09-30"}
