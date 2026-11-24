"""Fase 4B: the DAG helper (stdlib only, so it is tested here; the DAGs are checked in the image)."""

import importlib.util
import sys
from pathlib import Path

import pytest

_PATH = Path(__file__).resolve().parents[1] / "airflow" / "dags" / "kawan_pasar_common.py"
_SPEC = importlib.util.spec_from_file_location("kawan_pasar_common", _PATH)
assert _SPEC is not None and _SPEC.loader is not None
common = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(common)


def test_steps_do_not_receive_airflow_secrets(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AIRFLOW__DATABASE__SQL_ALCHEMY_CONN", "postgresql://airflow:rahasia@db/airflow")
    monkeypatch.setenv("AIRFLOW__CORE__FERNET_KEY", "kunci")
    monkeypatch.setenv("PYTHONPATH", "/opt/airflow/dags")
    monkeypatch.setenv("KP_STORE", "/data/store")
    env = common.child_env()
    assert not [k for k in env if k.startswith("AIRFLOW__") or k == "PYTHONPATH"]
    assert env["KP_STORE"] == "/data/store"


def test_credentials_reach_only_the_steps_that_need_them(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SERVICE_TOKEN", "t")
    monkeypatch.setenv("INGEST_DATABASE_URL", "postgres://ingest_w:x@pgbouncer/kawanpasar")
    monkeypatch.setenv("API_INTERNAL_URL", "http://api:3001")
    # The pipeline run (vendored ARIF-Net code that talks to the internet) gets none.
    assert not set(common.SECRETS) & set(common.child_env())
    register = common.child_env(allow=("API_INTERNAL_URL", "SERVICE_TOKEN"))
    assert "SERVICE_TOKEN" in register
    assert "INGEST_DATABASE_URL" not in register


def test_a_failing_step_fails_the_task_and_output_is_returned() -> None:
    out = common.call([sys.executable, "-c", "print('a'); print('{\"count\": 2}')"])
    assert common.last_json(out) == {"count": 2}
    with pytest.raises(RuntimeError, match="exited 3"):
        common.call([sys.executable, "-c", "import sys; sys.exit(3)"])


def test_run_ids_come_from_run_after_in_utc() -> None:
    from datetime import datetime, timedelta, timezone

    wib = timezone(timedelta(hours=7))
    rid = common.run_id("train", datetime(2026, 12, 7, 2, 0, tzinfo=wib))
    assert rid == "train-20261206T190000Z"
