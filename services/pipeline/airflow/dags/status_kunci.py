"""Hourly check of the prospective-test lock (Fase 4C).

Runs `kp-pipeline status` and keeps its result as the task's return value. The admin's Pipeline
page reads the last successful result through the Core API. Read-only: nothing is collected or
written, so it needs no pool.
"""

from __future__ import annotations

import pendulum
from airflow.sdk import DAG, task
from kawan_pasar_common import lock_status

with DAG(
    dag_id="status_kunci",
    description="Status kunci uji prospektif ARIF-Net (untuk halaman admin)",
    schedule="5 * * * *",
    start_date=pendulum.datetime(2026, 11, 23, tz="Asia/Jakarta"),
    catchup=False,
    max_active_runs=1,
    tags=["kawan-pasar", "pipeline"],
    default_args={"retries": 1, "retry_delay": pendulum.duration(minutes=5)},
) as dag:

    @task
    def status() -> dict:
        return lock_status()

    status()
