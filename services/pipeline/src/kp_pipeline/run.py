"""One retraining pipeline run (Fase 4A task 6): prepare → collect → preprocess → prices → train → bundle.

Every step of ARIF-Net runs exactly as ARIF-Net's run_all.py runs it (`python -m <module>`), in the
run's own staged copy, with ARIFNET_PHASE=development so its data end is the one this run sets
(ruling 4A-2). run.json records the lock state, the data end and each step, so a run can be audited
and resumed. The result is a candidate (model folder + forecast bundle + price files): nothing is
imported into the product or promoted here.
"""

import json
import os
import re
import shutil
import subprocess
import sys
from dataclasses import asdict, dataclass, field
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

from kp_pipeline.config import Commodity, load_commodities, write_project
from kp_pipeline.lock import PROSPECTIVE_DIR, LockState, Registration, evaluate
from kp_pipeline.paths import product_calendar
from kp_pipeline.store import (
    attach_store,
    chunks_after,
    export_prices,
    forget_open_month,
    remove_run_dir,
    write_climate_placeholder,
)
from kp_pipeline.vendor import stage

PRODUCT_CALENDAR = product_calendar()
RUN_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")
STEPS = ("prepare", "collect", "preprocess", "prices", "train", "bundle")
WIB = timedelta(hours=7)


class StepError(RuntimeError):
    """A step ended with an error; run.json says which and why."""


@dataclass
class RunOptions:
    store: Path
    runs: Path
    run_id: str
    quick: bool = False
    model_cmd: list[str] = field(default_factory=list)
    calendar: Path = PRODUCT_CALENDAR
    prospective_dir: Path = PROSPECTIVE_DIR
    today: date | None = None  # tests


def data_end_for(lock: LockState, today_wib: date) -> date:
    """While locked: the ceiling (2026-09-30). Once open: yesterday (today's report may be partial)."""
    return lock.data_ceiling if lock.data_ceiling is not None else today_wib - timedelta(days=1)


def _now() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


class Run:
    def __init__(self, opts: RunOptions) -> None:
        # Absolute once, here: steps run with cwd = the staged copy (runs 1 and 2 of Fase 4A failed
        # on relative paths: a broken store link, then a --root the train process could not find).
        opts.store, opts.runs = opts.store.resolve(), opts.runs.resolve()
        opts.calendar = opts.calendar.resolve()
        if not RUN_ID.fullmatch(opts.run_id):
            raise ValueError("run id: letters, digits, '.', '_', '-' (max 64), not starting with '.'")
        self.opts = opts
        self.dir = opts.runs / opts.run_id
        self.root = self.dir / "arifnet"
        self.out = self.dir / "out"
        self.state_path = self.dir / "run.json"
        self.state: dict[str, object] = (
            json.loads(self.state_path.read_text(encoding="utf-8")) if self.state_path.exists() else {}
        )
        self.commodities: list[Commodity] = load_commodities()

    # ── bookkeeping
    def _save(self) -> None:
        self.dir.mkdir(parents=True, exist_ok=True)
        self.state_path.write_text(json.dumps(self.state, indent=2, ensure_ascii=False) + "\n", "utf-8")

    def _steps(self) -> dict[str, dict[str, object]]:
        steps = self.state.setdefault("steps", {})
        assert isinstance(steps, dict)
        return steps

    def done(self, step: str) -> bool:
        return self._steps().get(step, {}).get("status") == "ok"

    @property
    def data_end(self) -> date:
        return date.fromisoformat(str(self.state["data_end"]))

    def _env(self) -> dict[str, str]:
        return {
            **os.environ,
            "ARIFNET_PHASE": "development",
            "PYTHONPATH": str(self.root),
            "PYTHONIOENCODING": "utf-8",
        }

    def _call(self, step: str, argv: list[str], env: dict[str, str] | None = None) -> str:
        log = self.dir / "logs" / f"{step}.log"
        log.parent.mkdir(parents=True, exist_ok=True)
        with log.open("a", encoding="utf-8") as f:
            f.write(f"$ {' '.join(argv)}\n")
            f.flush()
            # A list, never a shell: our interpreter + fixed module names, or the operator's KP_MODEL_CMD.
            proc = subprocess.run(  # noqa: S603
                argv, cwd=self.root, env=env or self._env(), stdout=subprocess.PIPE, stderr=f, text=True
            )
            f.write(proc.stdout)
        if proc.returncode != 0:
            raise StepError(f"{step}: `{' '.join(argv[-3:])}` exited {proc.returncode} (see logs/{step}.log)")
        return proc.stdout

    def _module(self, step: str, module: str, *args: str) -> str:
        return self._call(step, [sys.executable, "-m", module, *args])

    # ── steps
    def prepare(self) -> None:
        lock = evaluate(Registration.load(self.opts.prospective_dir), self.opts.prospective_dir)
        today = self.opts.today or (datetime.now(UTC) + WIB).date()
        end = data_end_for(lock, today)
        if not lock.open:
            # ARIF-Net's preprocessing reads every OK chunk of the store manifest: while the lock
            # holds, a store with data past the ceiling is refused before anything runs.
            late = chunks_after(self.opts.store, end)
            if late:
                raise StepError(
                    f"prepare: the store holds {len(late)} chunk(s) after the data end {end} "
                    f"(e.g. {late[0]}) while the prospective-test lock holds"
                )
        else:
            # Chunks fetched mid-month would otherwise count as done and freeze until next month.
            forget_open_month(self.opts.store, end)
        if (self.dir / "arifnet").exists():
            # A previous prepare failed half-way: start the copy again (the store link first).
            remove_run_dir(self.dir / "arifnet")
        root = stage(self.dir)
        write_project(root, self.commodities, end)
        attach_store(root, self.opts.store)
        write_climate_placeholder(root, date(2019, 1, 1), end)
        self.state.update(
            {
                "run_id": self.opts.run_id,
                "created_utc": _now(),
                "lock": {"open": lock.open, "reason": lock.reason, "opened_utc": lock.opened_utc},
                "data_end": end.isoformat(),
                "commodities": [asdict(c) for c in self.commodities],
                "quick": self.opts.quick,
            }
        )

    def collect(self) -> None:
        self._module("collect", "01_collection.collect_calendar")
        self._module("collect", "01_collection.collect_pihps", "full")
        # ARIF-Net's own completeness check: every month of every commodity up to the data end.
        self._module("collect", "01_collection.collect_pihps", "verify")

    def preprocess(self) -> None:
        for module in (
            "02_preprocessing.preprocess_pihps",
            "02_preprocessing.build_target",
            "02_preprocessing.build_dataset",
        ):
            self._module("preprocess", module)

    def prices(self) -> None:
        combined = self.root / "data" / "processed" / "pihps" / "prices_combined.csv"
        ingest_csv, model_csv = export_prices(combined, self.commodities, self.data_end, self.out)
        self.state["prices"] = {"ingest": ingest_csv.name, "model": model_csv.name}

    def train(self) -> None:
        codes = json.dumps({c.comcat_id: c.code for c in self.commodities})
        argv = [
            sys.executable,
            "-m",
            "kp_pipeline.train",
            "--root",
            str(self.root),
            "--out",
            str(self.out),
            "--data-end",
            self.data_end.isoformat(),
            "--run-id",
            self.opts.run_id,
            "--product-codes",
            codes,
            *(["--quick"] if self.opts.quick else []),
        ]
        result = json.loads(self._call("train", argv).strip().splitlines()[-1])
        # The product calendar (research holidays + flagged 2027 estimates, owner ruling K1):
        # forecasts look up to 365 days ahead, past the research calendar.
        shutil.copyfile(self.opts.calendar, self.out / "model" / "calendar_holidays.json")
        self.state["overall_relmae"] = result["overall_relmae"]

    def bundle(self) -> None:
        if not self.opts.model_cmd:
            raise StepError("bundle: no kp_model command configured")
        env = {**os.environ, "KP_MODEL_DIR": str(self.out / "model")}
        prices = self.out / "prices_model.csv"
        stdout = self._call(
            "bundle",
            [*self.opts.model_cmd, "--prices", str(prices), "--out", str(self.out / "bundles")],
            env=env,
        )
        self.state["bundle"] = Path(stdout.strip().splitlines()[-1]).name

    # ── driver
    def execute(self, only: tuple[str, ...] = STEPS) -> dict[str, object]:
        for step in STEPS:
            if step not in only or self.done(step):
                continue
            record: dict[str, object] = {"status": "running", "started_utc": _now()}
            self._steps()[step] = record
            self._save()
            try:
                getattr(self, step)()
            except Exception as e:
                record.update({"status": "failed", "finished_utc": _now(), "error": str(e)[:500]})
                self._save()
                raise StepError(str(e)) from e
            record.update({"status": "ok", "finished_utc": _now()})
            self._save()
        return self.state
