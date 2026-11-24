"""Shared by the Kawan Pasar DAGs (Fase 4B): every step is a CLI call into its own venv.

Airflow's own process never imports the pipeline (PyTorch, ARIF-Net) or the ingest code: the DAGs
only orchestrate. The pipeline runs in /opt/pipeline (Python 3.12), the price import in
/opt/ingest (Python 3.14), as in their own containers.
"""

from __future__ import annotations

import json
import os
import signal
import subprocess
from datetime import UTC, datetime

PIPELINE = os.environ.get("KP_PIPELINE_BIN", "/opt/pipeline/.venv/bin/kp-pipeline")
INGEST_PYTHON = os.environ.get("KP_INGEST_PYTHON", "/opt/ingest/.venv/bin/python")
STORE = os.environ.get("KP_STORE", "/data/store")
RUNS = os.environ.get("KP_RUNS", "/data/runs")
# Price-only runs kept on disk; the rest are removed (never the evidence store). Retraining runs
# hold the candidate bundles an admin still has to audit: they are not cleaned here (4C cleans
# them by candidate status).
KEEP_PRICE_RUNS = max(1, int(os.environ.get("KP_KEEP_RUNS", "10")))
# Design § 4: at most 3 retraining runs a day (rejections re-run the pipeline in 4C).
TRAIN_RUNS_PER_DAY = 3
# One writer at a time on the evidence store, across both DAGs (pool made by airflow-init).
STORE_POOL = "kp_store"
# Credentials only the steps that need them receive.
SECRETS = ("SERVICE_TOKEN", "INGEST_DATABASE_URL", "API_INTERNAL_URL")


def run_id(prefix: str, run_after: datetime) -> str:
    """The pipeline run id of a DAG run: `prefix-YYYYmmddTHHMMSSZ` (UTC) from `dag_run.run_after`,
    which manual runs have too (Airflow 3 manual runs have no logical date)."""
    return f"{prefix}-{run_after.astimezone(UTC).strftime('%Y%m%dT%H%M%SZ')}"


def child_env(allow: tuple[str, ...] = ()) -> dict[str, str]:
    """The environment of a step: without Airflow's own settings (its database URL, Fernet key and
    JWT secret), without the DAG folder on its Python path (each step runs in its own venv), and
    without the credentials in SECRETS except those listed in `allow`."""
    return {
        k: v
        for k, v in os.environ.items()
        if not k.startswith(("AIRFLOW__", "_AIRFLOW"))
        and k != "PYTHONPATH"
        and (k not in SECRETS or k in allow)
    }


def call(argv: list[str], allow: tuple[str, ...] = ()) -> str:
    """Runs a CLI; its output goes to the task log. A failure fails the task with the exit code.
    If the task is stopped (timeout, mark failed), the whole process group is stopped too, so no
    training process keeps writing into a run that a retry resumes."""
    proc = subprocess.Popen(  # noqa: S603 - fixed executables, arguments built by the DAGs
        argv,
        env=child_env(allow),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        start_new_session=True,
    )
    try:
        out, _ = proc.communicate()
    except BaseException:
        _stop_group(proc)
        raise
    print(out)
    if proc.returncode != 0:
        raise RuntimeError(
            f"{os.path.basename(argv[0])} {argv[1] if len(argv) > 1 else ''} exited {proc.returncode}"
        )
    return out


def _stop_group(proc: subprocess.Popen[str]) -> None:
    killpg = getattr(os, "killpg", None)  # POSIX only (the Airflow image)
    for sig, wait in ((signal.SIGTERM, 30), (getattr(signal, "SIGKILL", signal.SIGTERM), 5)):
        if proc.poll() is not None:
            return
        if killpg is not None:
            try:
                killpg(proc.pid, sig)
            except ProcessLookupError:
                return
        else:
            proc.terminate()
        try:
            proc.wait(timeout=wait)
        except subprocess.TimeoutExpired:
            continue


def last_json(output: str) -> dict:
    """The JSON summary each CLI prints on its last line."""
    return json.loads(output.strip().splitlines()[-1])


def lock_status() -> dict:
    """{"open": bool, "data_ceiling": "YYYY-MM-DD" | "None", "reason": str}"""
    return last_json(call([PIPELINE, "status"]))


def run_state(rid: str) -> dict:
    """The run.json of a pipeline run (data end and lock state at the time of the run)."""
    with open(f"{RUNS}/{rid}/run.json", encoding="utf-8") as f:
        return json.load(f)
