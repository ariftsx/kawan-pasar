"""Prospective-test lock (ARIF-Net protocol v1.1.0 § 4, owner decision P5).

"The weekly pipeline (Airflow/PC) does not train or evaluate on data after 2026-09-30 before the
one-time opening." Until ARIF-Net's results/prospektif/OPENED.json proves a finished, real opening
of the registered frozen models, every pipeline step is held to data <= train_end.

Only a summary of REGISTERED.json is kept in the repository (dates and the hash of the frozen
configurations): the full file carries details of the researcher's machine.
"""

import hashlib
import json
from dataclasses import dataclass
from datetime import date
from pathlib import Path

from kp_pipeline.paths import prospective_dir

PROSPECTIVE_DIR = prospective_dir()


class LockError(RuntimeError):
    """The proof of opening exists but cannot be read: never treated as open."""


def frozen_sha256(frozen: object) -> str:
    """Hash of the frozen configurations, canonicalised the way ARIF-Net compares them."""
    return hashlib.sha256(json.dumps(frozen, sort_keys=True).encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class Registration:
    registered_utc: str
    train_end: date
    cutoff: date
    frozen_sha256: str

    @staticmethod
    def load(folder: Path = PROSPECTIVE_DIR) -> "Registration":
        raw = json.loads((folder / "registration.json").read_text(encoding="utf-8"))
        return Registration(
            registered_utc=str(raw["registered_utc"]),
            train_end=date.fromisoformat(str(raw["train_end"])),
            cutoff=date.fromisoformat(str(raw["cutoff"])),
            frozen_sha256=str(raw["frozen_sha256"]),
        )


@dataclass(frozen=True)
class LockState:
    open: bool
    # Latest date any step may use; None once the lock is open (no ceiling).
    data_ceiling: date | None
    reason: str
    opened_utc: str | None = None


def evaluate(reg: Registration, folder: Path = PROSPECTIVE_DIR) -> LockState:
    def locked(reason: str) -> LockState:
        return LockState(open=False, data_ceiling=reg.train_end, reason=reason)

    path = folder / "OPENED.json"
    if not path.exists():
        return locked("Uji prospektif ARIF-Net belum dibuka (OPENED.json belum ada).")
    try:
        opened = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        raise LockError(f"OPENED.json tidak terbaca: {type(e).__name__}") from e
    if not isinstance(opened, dict):
        raise LockError("OPENED.json bukan objek JSON")
    if opened.get("role") != "prospektif":
        return locked("OPENED.json bukan pembukaan prospektif.")
    if opened.get("dry_run") is not False:
        return locked("OPENED.json berasal dari uji coba (dry run).")
    if not opened.get("finished_utc"):
        return locked("Pembukaan uji prospektif belum selesai.")
    if frozen_sha256(opened.get("frozen")) != reg.frozen_sha256:
        return locked("Konfigurasi beku di OPENED.json tidak sama dengan registrasi.")
    return LockState(
        open=True,
        data_ceiling=None,
        reason="Uji prospektif sudah dibuka; pipeline boleh memakai data terbaru.",
        opened_utc=str(opened.get("opened_utc")),
    )
