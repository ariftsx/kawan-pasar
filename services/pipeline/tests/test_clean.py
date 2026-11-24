"""Fase 4B task 6: old runs are removed without ever touching the shared evidence store."""

import json
from pathlib import Path

from kp_pipeline.store import attach_store, clean_runs


def _run(runs: Path, run_id: str, created: str, store: Path | None = None) -> Path:
    d = runs / run_id
    (d / "arifnet").mkdir(parents=True)
    (d / "run.json").write_text(json.dumps({"run_id": run_id, "created_utc": created}), encoding="utf-8")
    if store is not None:
        attach_store(d / "arifnet", store)
    return d


def test_keeps_the_latest_and_the_listed_runs_and_never_the_store(tmp_path: Path) -> None:
    store = tmp_path / "store"
    (store / "pihps").mkdir(parents=True)
    (store / "pihps" / "manifest.csv").write_text("comcat_id\n", encoding="utf-8")
    runs = tmp_path / "runs"
    for i, rid in enumerate(["a", "b", "c", "d"]):
        _run(runs, rid, f"2026-12-0{i + 1}T00:00:00+00:00", store)
    removed = clean_runs(runs, keep_latest=2, keep={"a"})
    assert removed == ["b"]
    assert sorted(p.name for p in runs.iterdir()) == ["a", "c", "d"]
    assert (store / "pihps" / "manifest.csv").read_text(encoding="utf-8") == "comcat_id\n"


def test_ignores_folders_that_are_not_runs(tmp_path: Path) -> None:
    runs = tmp_path / "runs"
    (runs / "notes").mkdir(parents=True)
    _run(runs, "a", "2026-12-01T00:00:00+00:00")
    _run(runs, "b", "2026-12-02T00:00:00+00:00")
    assert clean_runs(runs, keep_latest=1, keep=set()) == ["a"]
    assert (runs / "notes").exists()


def test_only_runs_with_the_prefix_are_cleaned_and_corrupt_runs_are_left(tmp_path: Path) -> None:
    from kp_pipeline.store import clean_runs

    for i, rid in enumerate(["prices-a", "prices-b", "train-a"]):
        (tmp_path / rid).mkdir()
        (tmp_path / rid / "run.json").write_text(
            json.dumps({"created_utc": f"2026-12-0{i + 1}T00:00:00+00:00"}), encoding="utf-8"
        )
    (tmp_path / "prices-broken").mkdir()
    (tmp_path / "prices-broken" / "run.json").write_text("{not json", encoding="utf-8")
    # Retraining runs hold candidates under audit: a prices-only clean never touches them.
    assert clean_runs(tmp_path, 1, set(), prefix="prices-") == ["prices-a"]
    assert sorted(p.name for p in tmp_path.iterdir()) == ["prices-b", "prices-broken", "train-a"]
