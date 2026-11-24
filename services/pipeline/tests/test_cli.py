"""The kp-pipeline command line."""

import json
from datetime import UTC, datetime
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


def test_clean_reports_what_it_removed(capsys: pytest.CaptureFixture[str], tmp_path: Path) -> None:
    for i, rid in enumerate(["old", "new"]):
        (tmp_path / rid).mkdir()
        (tmp_path / rid / "run.json").write_text(
            json.dumps({"created_utc": f"2026-12-0{i + 1}T00:00:00+00:00"}), encoding="utf-8"
        )
    assert main(["clean", "--runs", str(tmp_path), "--keep-latest", "1"]) == 0
    assert json.loads(capsys.readouterr().out) == {"removed": ["old"]}


def test_register_needs_the_api_and_a_token_from_the_environment(
    capsys: pytest.CaptureFixture[str], tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("SERVICE_TOKEN", raising=False)
    assert main(["register", "--run", str(tmp_path), "--api", "http://api:3001"]) == 2
    assert "SERVICE_TOKEN" in capsys.readouterr().err
    monkeypatch.setenv("SERVICE_TOKEN", "t")
    # Not a finished run: refused before anything is sent.
    (tmp_path / "run.json").write_text(json.dumps({"steps": {}}), encoding="utf-8")
    assert main(["register", "--run", str(tmp_path), "--api", "http://api:3001"]) == 1


def test_runs_today_counts_only_todays_runs_with_the_prefix(
    capsys: pytest.CaptureFixture[str], tmp_path: Path
) -> None:
    now = datetime.now(UTC).isoformat(timespec="seconds")
    for rid, created in [("train-a", now), ("train-b", "2020-01-01T00:00:00+00:00"), ("prices-a", now)]:
        (tmp_path / rid).mkdir()
        (tmp_path / rid / "run.json").write_text(json.dumps({"created_utc": created}), encoding="utf-8")
    assert main(["runs-today", "--runs", str(tmp_path), "--prefix", "train-"]) == 0
    assert json.loads(capsys.readouterr().out) == {"count": 1}
