"""ARIF-Net A0 retraining → candidate (Fase 4B/4C, owner decisions P4, P5, P8, K2).

Every day at 02.00 WIB: is today a training day (the admin's schedule preset, Fase 4C K2)? → check
the lock → at most 3 runs a day → full pipeline (collect → preprocess → score → final fit →
bundle) → register the candidate with the Core API → remove old retraining runs, keeping the ones
an admin still has to decide and the one whose bundle is active.
A candidate is never promoted here: an admin audits and approves it on the Model page.
Manual runs (from the admin page) do not depend on the schedule.

While the prospective-test lock holds, scheduled runs are skipped. A manual run with
`even_if_locked` (verification only) trains on data up to 2026-09-30, which the protocol allows:
the pipeline evaluates the lock again when it prepares the run.
"""

from __future__ import annotations

import pendulum
from airflow.sdk import DAG, Param, get_current_context, task
from airflow.sdk.exceptions import AirflowSkipException
from kawan_pasar_common import (
    KEEP_TRAIN_RUNS,
    PIPELINE,
    RUNS,
    STORE,
    STORE_POOL,
    TRAIN_RUNS_PER_DAY,
    call,
    core_api,
    last_json,
    lock_status,
    run_id,
)

with DAG(
    dag_id="latih_ulang",
    description="Latih ulang ARIF-Net A0 → kandidat untuk diaudit admin",
    # The admin's preset decides which of these daily runs actually train (check_schedule).
    schedule="0 2 * * *",
    start_date=pendulum.datetime(2026, 11, 23, tz="Asia/Jakarta"),
    catchup=False,
    max_active_runs=1,
    tags=["kawan-pasar", "pipeline", "arif-net"],
    params={
        "even_if_locked": Param(False, type="boolean", description="Verifikasi saja: data ≤ 30 Sep 2026"),
        "quick": Param(False, type="boolean", description="Uji: 1 epoch (kandidat tidak untuk rilis)"),
    },
    default_args={"retries": 1, "retry_delay": pendulum.duration(minutes=30)},
) as dag:

    @task
    def check_schedule() -> dict:
        ctx = get_current_context()
        if ctx["dag_run"].run_type == "manual":
            return {"manual": True}
        gate = core_api("/internal/pipeline/schedule")
        if not gate["train"]:
            nxt = gate.get("next") or "hanya manual"
            raise AirflowSkipException(f"Bukan jadwal latih ulang ({gate['preset']}); berikutnya: {nxt}.")
        return gate

    @task
    def check_lock(_: dict) -> dict:
        params = get_current_context()["params"]
        status = lock_status()
        if not status["open"] and not params["even_if_locked"]:
            raise AirflowSkipException(f"Kunci uji prospektif: {status['reason']}")
        return status

    @task
    def check_quota(_: dict) -> int:
        count = last_json(call([PIPELINE, "runs-today", "--runs", RUNS, "--prefix", "train-"]))["count"]
        if count >= TRAIN_RUNS_PER_DAY:
            raise AirflowSkipException(
                f"Sudah {count} kali latih ulang hari ini (batas {TRAIN_RUNS_PER_DAY})."
            )
        return count

    @task(pool=STORE_POOL, execution_timeout=pendulum.duration(hours=3))
    def retrain(_: int) -> str:
        ctx = get_current_context()
        rid = run_id("train", ctx["dag_run"].run_after)
        call(
            [
                PIPELINE,
                "run",
                "--store",
                STORE,
                "--runs",
                RUNS,
                "--run-id",
                rid,
                *(["--quick"] if ctx["params"]["quick"] else []),
            ]
        )
        return rid

    @task
    def register(rid: str) -> dict:
        # Only this step receives the Core API URL and the service token.
        return last_json(
            call(
                [PIPELINE, "register", "--run", f"{RUNS}/{rid}"],
                allow=("API_INTERNAL_URL", "SERVICE_TOKEN"),
            )
        )

    @task(pool=STORE_POOL)
    def clean(_: dict) -> dict:
        keep = core_api("/internal/pipeline/keep-runs")["runIds"]
        return last_json(
            call(
                [
                    PIPELINE,
                    "clean",
                    "--runs",
                    RUNS,
                    "--prefix",
                    "train-",
                    "--keep",
                    ",".join(keep),
                    "--keep-latest",
                    str(KEEP_TRAIN_RUNS),
                ]
            )
        )

    clean(register(retrain(check_quota(check_lock(check_schedule())))))
