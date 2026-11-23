"""Task 6: the run's data end follows the lock, and `prepare` records it."""

import json
from datetime import date
from pathlib import Path

import pytest

from kp_pipeline.lock import LockState
from kp_pipeline.run import Run, RunOptions, StepError, data_end_for
from kp_pipeline.store import forget_open_month


def test_locked_runs_stop_at_the_ceiling_open_runs_at_yesterday() -> None:
    locked = LockState(open=False, data_ceiling=date(2026, 9, 30), reason="")
    opened = LockState(open=True, data_ceiling=None, reason="")
    assert data_end_for(locked, date(2026, 11, 23)) == date(2026, 9, 30)
    assert data_end_for(opened, date(2026, 12, 20)) == date(2026, 12, 19)


def test_prepare_stages_configures_and_records_the_lock(tmp_path: Path) -> None:
    opts = RunOptions(store=tmp_path / "store", runs=tmp_path / "runs", run_id="t1", today=date(2026, 11, 23))
    state = Run(opts).execute(("prepare",))
    run = tmp_path / "runs" / "t1"
    assert state["data_end"] == "2026-09-30"
    assert state["lock"] == {
        "open": False,
        "reason": "Uji prospektif ARIF-Net belum dibuka (OPENED.json belum ada).",
        "opened_utc": None,
    }
    project = json.loads((run / "arifnet" / "configs" / "project.json").read_text(encoding="utf-8"))
    assert project["data_end"] == "2026-09-30"
    assert [c["comcat_id"] for c in project["commodities"]] == [
        "com_14",
        "com_11",
        "com_3",
        "com_15",
        "com_16",
    ]
    # The evidence store is shared through the run's data/raw/pihps.
    assert (run / "arifnet" / "data" / "raw" / "pihps").resolve() == (tmp_path / "store" / "pihps").resolve()
    saved = json.loads((run / "run.json").read_text(encoding="utf-8"))
    assert saved["steps"]["prepare"]["status"] == "ok"
    # A second execute resumes: prepare is not repeated (staging twice would fail).
    Run(opts).execute(("prepare",))


def test_a_relative_store_path_still_links_to_the_store(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Regression (4A run 1): a relative store path made a link relative to the link's own folder.
    monkeypatch.chdir(tmp_path)
    (tmp_path / "store" / "pihps").mkdir(parents=True)
    (tmp_path / "store" / "pihps" / "manifest.csv").write_text("comcat_id\n", encoding="utf-8")
    (tmp_path / "sub").mkdir()
    # With "..", like the first real run (cwd services/pipeline, store ../../data/pipeline/store).
    opts = RunOptions(store=Path("sub/../store"), runs=Path("runs"), run_id="rel", today=date(2026, 11, 23))
    Run(opts).execute(("prepare",))
    manifest = tmp_path / "runs" / "rel" / "arifnet" / "data" / "raw" / "pihps" / "manifest.csv"
    assert manifest.read_text(encoding="utf-8") == "comcat_id\n"
    # ARIF-Net's writers call mkdir(parents=True, exist_ok=True) on this folder.
    manifest.parent.mkdir(parents=True, exist_ok=True)


def test_every_path_a_run_passes_on_is_absolute(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    # Regression (4A run 2): steps run with cwd = the staged copy, so a relative --root broke `train`.
    monkeypatch.chdir(tmp_path)
    run = Run(RunOptions(store=Path("a/../store"), runs=Path("runs"), run_id="abs"))
    for path in (run.dir, run.root, run.out, run.opts.store, run.opts.runs):
        assert path.is_absolute(), path
        assert ".." not in path.parts, path


def _store_with(tmp_path: Path, chunks: list[tuple[str, str]]) -> Path:
    """A store manifest with OK rows (chunk, end_date)."""
    store = tmp_path / "store"
    (store / "pihps").mkdir(parents=True)
    lines = ["comcat_id,chunk,start_date,end_date,http_status,check,collected_at_utc,raw_file,raw_sha256"]
    for chunk, end in chunks:
        lines.append(f"com_14,{chunk},{chunk}-01,{end},200,OK,2026-12-10T00:00:00+00:00,x,y")
    (store / "pihps" / "manifest.csv").write_text("\n".join(lines) + "\n", encoding="utf-8")
    return store


def test_a_locked_run_refuses_a_store_holding_data_after_the_ceiling(tmp_path: Path) -> None:
    # Review finding (Fase 4A): ARIF-Net's preprocessing reads every OK chunk of the manifest.
    store = _store_with(tmp_path, [("2026-09", "2026-09-30"), ("2026-10", "2026-10-31")])
    opts = RunOptions(store=store, runs=tmp_path / "runs", run_id="lk", today=date(2026, 11, 23))
    with pytest.raises(StepError, match="after the data end"):
        Run(opts).execute(("prepare",))


def test_an_open_run_refetches_the_month_of_its_data_end(tmp_path: Path) -> None:
    # Review finding: a mid-month chunk would otherwise count as done and freeze for the month.
    store = _store_with(tmp_path, [("2026-11", "2026-11-30"), ("2026-12", "2026-12-04")])
    dropped = forget_open_month(store, date(2026, 12, 9))
    assert dropped == 1
    text = (store / "pihps" / "manifest.csv").read_text(encoding="utf-8")
    assert "2026-11" in text
    assert ",2026-12," not in text


def test_a_failed_prepare_can_be_retried(tmp_path: Path) -> None:
    store = _store_with(tmp_path, [("2026-10", "2026-10-31")])
    opts = RunOptions(store=store, runs=tmp_path / "runs", run_id="rt", today=date(2026, 11, 23))
    with pytest.raises(StepError):
        Run(opts).execute(("prepare",))
    (store / "pihps" / "manifest.csv").write_text("comcat_id\n", encoding="utf-8")
    state = Run(opts).execute(("prepare",))
    steps = state["steps"]
    assert isinstance(steps, dict)
    assert steps["prepare"]["status"] == "ok"
    # The store was never touched by the clean-up of the failed attempt.
    assert (store / "pihps" / "manifest.csv").exists()


@pytest.mark.parametrize("run_id", ["../x", "a/b", "", ".hidden", "x" * 65])
def test_run_ids_cannot_leave_the_runs_folder(tmp_path: Path, run_id: str) -> None:
    with pytest.raises(ValueError, match="run id"):
        Run(RunOptions(store=tmp_path / "s", runs=tmp_path / "r", run_id=run_id))
