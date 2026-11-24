"""Checks the Kawan Pasar DAGs inside the Airflow image (Fase 4B): they import without errors, have
the schedules, order, pools and limits of the plan, and their gate tasks skip as the protocol
requires (lock closed → skipped; `even_if_locked` only when asked; daily quota). The gate tasks
are called directly with a stubbed lock status: nothing runs and nothing is collected.
Run: python /opt/airflow/check_dags.py"""

from __future__ import annotations

import sys
from collections.abc import Callable
from typing import Any

from airflow.dag_processing.dagbag import DagBag
from airflow.sdk.exceptions import AirflowSkipException

EXPECTED = {
    "harga_harian": ("0 10 * * 1-5", ["check_lock", "collect_prices", "import_prices", "clean"]),
    "latih_ulang": ("0 2 * * 1", ["check_lock", "check_quota", "retrain", "register"]),
}
# Tasks that write to the evidence store or the runs folder: one at a time across both DAGs.
POOLED = {"harga_harian": {"collect_prices", "clean"}, "latih_ulang": {"retrain"}}
LOCKED = {"open": False, "data_ceiling": "2026-09-30", "reason": "OPENED.json belum ada"}
OPEN = {"open": True, "data_ceiling": "None", "reason": "terbuka"}


def chain(dag: Any) -> list[str]:
    """Task ids from the root following the single downstream edge."""
    roots = [t for t in dag.tasks if not t.upstream_task_ids]
    assert len(roots) == 1, roots
    order, task = [], roots[0]
    while True:
        order.append(task.task_id)
        nxt = list(task.downstream_list)
        if not nxt:
            return order
        assert len(nxt) == 1, nxt
        task = nxt[0]


def gate(
    dag: Any,
    task_id: str,
    *,
    status: dict | None = None,
    params: dict | None = None,
    quota: int | None = None,
) -> Callable[[], Any]:
    """The task's own function with its lock status, context and CLI call stubbed."""
    fn = dag.get_task(task_id).python_callable
    g = fn.__globals__
    if status is not None:
        g["lock_status"] = lambda: status
    g["get_current_context"] = lambda: {"params": params or {}}
    if quota is not None:
        g["call"] = lambda argv, allow=(): f'{{"count": {quota}}}'
    return (lambda: fn({})) if task_id == "check_quota" else fn


def skips(run: Callable[[], Any]) -> bool:
    try:
        run()
    except AirflowSkipException:
        return True
    return False


def main() -> int:
    bag = DagBag(dag_folder="/opt/airflow/dags")
    problems = [f"import error {k}: {v}" for k, v in bag.import_errors.items()]
    for dag_id, (cron, order) in EXPECTED.items():
        dag = bag.dags.get(dag_id)
        if dag is None:
            problems.append(f"{dag_id} missing")
            continue
        expr = getattr(dag.timetable, "expression", None)
        tz = str(getattr(dag.timetable, "timezone", ""))
        if expr != cron or "Jakarta" not in tz:
            problems.append(f"{dag_id} schedule {expr} {tz}")
        if dag.catchup or dag.max_active_runs != 1:
            problems.append(f"{dag_id} catchup={dag.catchup} max_active_runs={dag.max_active_runs}")
        if chain(dag) != order:
            problems.append(f"{dag_id} order {chain(dag)}")
        pooled = {t.task_id for t in dag.tasks if t.pool == "kp_store"}
        if pooled != POOLED[dag_id]:
            problems.append(f"{dag_id} kp_store pool on {sorted(pooled)}")
    if sorted(bag.dags) != sorted(EXPECTED):
        problems.append(f"unexpected DAGs {sorted(bag.dags)}")
    if problems:
        print("\n".join(problems))
        return 1

    daily, train = bag.dags["harga_harian"], bag.dags["latih_ulang"]
    behaviour = {
        "harga_harian skips while locked": skips(gate(daily, "check_lock", status=LOCKED)),
        "harga_harian runs once open": not skips(gate(daily, "check_lock", status=OPEN)),
        "latih_ulang skips while locked": skips(
            gate(train, "check_lock", status=LOCKED, params={"even_if_locked": False})
        ),
        "latih_ulang verifies when locked only if asked": not skips(
            gate(train, "check_lock", status=LOCKED, params={"even_if_locked": True})
        ),
        "latih_ulang runs once open": not skips(
            gate(train, "check_lock", status=OPEN, params={"even_if_locked": False})
        ),
        "latih_ulang stops at 3 runs a day": skips(gate(train, "check_quota", quota=3)),
        "latih_ulang allows a 3rd run": not skips(gate(train, "check_quota", quota=2)),
    }
    failed = [name for name, ok in behaviour.items() if not ok]
    if failed:
        print("\n".join(f"FAIL {n}" for n in failed))
        return 1
    print(f"ok: {', '.join(sorted(bag.dags))}")
    print("\n".join(f"ok: {n}" for n in behaviour))
    return 0


if __name__ == "__main__":
    sys.exit(main())
