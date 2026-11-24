"""kp-pipeline: the ARIF-Net retraining pipeline (Fase 4A). Airflow drives the same commands (4B).

  kp-pipeline status
  kp-pipeline seed --arifnet <ARIF-Net folder> --store <store>
  kp-pipeline run  --store <store> --runs <runs> [--run-id ID] [--steps a,b] [--quick]
  kp-pipeline clean --runs <runs> [--keep-latest N] [--keep id,id] [--prefix prices-]

Exit codes: 0 done, 1 a step failed (run.json and logs/<step>.log say why), 2 bad invocation.
"""

import argparse
import json
import os
import shlex
import sys
from datetime import UTC, datetime
from pathlib import Path

from kp_pipeline.candidate import CandidateError, build_payload, post_candidate
from kp_pipeline.lock import Registration, evaluate
from kp_pipeline.paths import home
from kp_pipeline.run import (
    PRODUCT_CALENDAR,
    STEPS,
    Run,
    RunOptions,
    StepError,
    runs_created_on,
    wib_today,
)
from kp_pipeline.store import clean_runs, seed_from_arifnet


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
    clean = sub.add_parser("clean", help="remove old runs (never the evidence store)")
    clean.add_argument("--runs", required=True, type=Path)
    clean.add_argument("--keep-latest", type=int, default=5)
    clean.add_argument("--keep", default="", help="comma-separated run ids to keep (pending/approved)")
    clean.add_argument("--prefix", default="", help="only runs whose id starts with this")
    reg = sub.add_parser("register", help="register a finished run as a candidate (Core API)")
    reg.add_argument("--run", required=True, type=Path)
    reg.add_argument("--api", default=os.environ.get("API_INTERNAL_URL", ""))
    today = sub.add_parser("runs-today", help="runs created today (WIB) whose id has this prefix")
    today.add_argument("--runs", required=True, type=Path)
    today.add_argument("--prefix", default="")
    args = ap.parse_args(argv)

    lock = evaluate(Registration.load())
    if args.command == "status":
        print(json.dumps({"open": lock.open, "data_ceiling": str(lock.data_ceiling), "reason": lock.reason}))
        return 0
    if args.command == "register":
        # The token only ever comes from the environment (never argv, which other processes see).
        token = os.environ.get("SERVICE_TOKEN", "")
        if not token or not args.api:
            print("register needs API_INTERNAL_URL (or --api) and SERVICE_TOKEN", file=sys.stderr)
            return 2
        try:
            cid, created = post_candidate(build_payload(args.run.resolve()), args.api, token)
        except CandidateError as e:
            print(f"kp-pipeline: {e}", file=sys.stderr)
            return 1
        print(json.dumps({"candidate_id": cid, "already_registered": not created}))
        return 0
    if args.command == "runs-today":
        print(json.dumps({"count": runs_created_on(args.runs.resolve(), wib_today(), args.prefix)}))
        return 0
    if args.command == "clean":
        keep = {k.strip() for k in args.keep.split(",") if k.strip()}
        removed = clean_runs(args.runs.resolve(), max(1, args.keep_latest), keep, args.prefix)
        print(json.dumps({"removed": removed}))
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
