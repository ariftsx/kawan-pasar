"""Daily PIHPS prices into Kawan Pasar (Fase 4B, owner decision P1).

Monday-Friday 10.00 WIB: check the prospective-test lock → collect and preprocess (no training) →
import the new prices into the product → remove old price runs. While the lock holds, the run is
skipped with its reason: no data after 2026-09-30 may be collected (protocol v1.1.0 § 4).
"""

from __future__ import annotations

import pendulum
from airflow.sdk import DAG, get_current_context, task
from airflow.sdk.exceptions import AirflowSkipException
from kawan_pasar_common import (
    INGEST_PYTHON,
    KEEP_PRICE_RUNS,
    PIPELINE,
    RUNS,
    STORE,
    STORE_POOL,
    call,
    last_json,
    lock_status,
    run_id,
    run_state,
)

with DAG(
    dag_id="harga_harian",
    description="PIHPS → harga Kawan Pasar (tanpa latih ulang)",
    schedule="0 10 * * 1-5",
    start_date=pendulum.datetime(2026, 11, 23, tz="Asia/Jakarta"),
    catchup=False,
    max_active_runs=1,
    tags=["kawan-pasar", "pipeline"],
    default_args={"retries": 2, "retry_delay": pendulum.duration(minutes=15)},
) as dag:

    @task
    def check_lock() -> dict:
        status = lock_status()
        if not status["open"]:
            # Skipped, not failed: a locked day is the expected state until the opening.
            raise AirflowSkipException(f"Kunci uji prospektif: {status['reason']}")
        return status

    @task(pool=STORE_POOL)
    def collect_prices(_: dict) -> str:
        rid = run_id("prices", get_current_context()["dag_run"].run_after)
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
                "--steps",
                "prepare,collect,preprocess,prices",
            ]
        )
        return rid

    @task
    def import_prices(rid: str) -> dict:
        # The ceiling is the run's own data end (from the lock when the run was prepared), never a
        # value carried over from another task: a cleared and re-run task stays bounded.
        ceiling = str(run_state(rid)["data_end"])
        out = call(
            [
                INGEST_PYTHON,
                "-m",
                "kp_ingest",
                "import-pihps",
                "--file",
                f"{RUNS}/{rid}/out/prices_pihps.csv",
                "--ceiling",
                ceiling,
            ],
            allow=("INGEST_DATABASE_URL", "API_INTERNAL_URL", "SERVICE_TOKEN"),
        )
        return last_json(out)

    @task(pool=STORE_POOL)
    def clean(_: dict) -> dict:
        return last_json(
            call(
                [
                    PIPELINE,
                    "clean",
                    "--runs",
                    RUNS,
                    "--prefix",
                    "prices-",
                    "--keep-latest",
                    str(KEEP_PRICE_RUNS),
                ]
            )
        )

    clean(import_prices(collect_prices(check_lock())))
