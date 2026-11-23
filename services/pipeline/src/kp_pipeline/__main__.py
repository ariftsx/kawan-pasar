"""kp-pipeline: the ARIF-Net retraining pipeline (Fase 4A). Airflow drives the same commands (4B).

  kp-pipeline status
  kp-pipeline seed --arifnet <ARIF-Net folder> --store <store>
  kp-pipeline run  --store <store> --runs <runs> [--run-id ID] [--steps a,b] [--quick]

Exit codes: 0 done, 1 a step failed (run.json and logs/<step>.log say why), 2 bad invocation.
"""

import argparse
import json
import os
import shlex
import sys
from datetime import UTC, datetime
from pathlib import Path

from kp_pipeline.lock import Registration, evaluate
from kp_pipeline.paths import home
from kp_pipeline.run import PRODUCT_CALENDAR, STEPS, Run, RunOptions, StepError
from kp_pipeline.store import seed_from_arifnet


def _default_model_cmd() -> list[str]:
    # The image sets KP_MODEL_CMD; locally the model service's own uv project is used.
    raw = os.environ.get("KP_MODEL_CMD")
    if raw:
        return shlex.split(raw)
    model = home().parent / "model-arifnet"
    return ["uv", "run", "--project", str(model), "python", "-m", "kp_model"]


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="kp-pipeline")
    sub = ap.add_subparsers(dest="command", required=True)
    sub.add_parser("status", help="prospective-test lock state")
    seed = sub.add_parser("seed", help="import ARIF-Net's raw PIHPS evidence up to the ceiling (once)")
    seed.add_argument("--arifnet", required=True, type=Path)
    seed.add_argument("--store", required=True, type=Path)
    run = sub.add_parser("run", help="run the pipeline (resumes an existing run id)")
    run.add_argument("--store", required=True, type=Path)
    run.add_argument("--runs", required=True, type=Path)
    run.add_argument("--run-id", default=datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ"))
    run.add_argument("--steps", default=",".join(STEPS))
    run.add_argument("--quick", action="store_true", help="tests only: 1 epoch")
    run.add_argument("--calendar", type=Path, default=PRODUCT_CALENDAR)
    args = ap.parse_args(argv)

    lock = evaluate(Registration.load())
    if args.command == "status":
        print(json.dumps({"open": lock.open, "data_ceiling": str(lock.data_ceiling), "reason": lock.reason}))
        return 0
    if args.command == "seed":
        if lock.data_ceiling is None:
            print("seed is only for the locked period (history up to the registration)", file=sys.stderr)
            return 2
        n = seed_from_arifnet(args.arifnet, args.store, lock.data_ceiling)
        print(json.dumps({"copied_chunks": n, "ceiling": lock.data_ceiling.isoformat()}))
        return 0
    steps = tuple(s.strip() for s in args.steps.split(",") if s.strip())
    unknown = [s for s in steps if s not in STEPS]
    if unknown:
        print(f"unknown steps: {unknown}; choose from {list(STEPS)}", file=sys.stderr)
        return 2
    opts = RunOptions(
        store=args.store,
        runs=args.runs,
        run_id=args.run_id,
        quick=args.quick,
        model_cmd=_default_model_cmd(),
        calendar=args.calendar,
    )
    try:
        state = Run(opts).execute(steps)
    except StepError as e:
        print(f"kp-pipeline: {e}", file=sys.stderr)
        return 1
    print(json.dumps({k: state.get(k) for k in ("run_id", "data_end", "lock", "overall_relmae", "bundle")}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
