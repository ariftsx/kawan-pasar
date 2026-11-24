"""Task 3: the prospective-test lock (ARIF-Net protocol v1.1.0 § 4).

Before the one-time opening, the automated pipeline may not train or evaluate on data after
train_end (2026-09-30). The lock opens only on proof of a finished, real opening whose frozen
configurations are the registered ones.
"""

import hashlib
import json
from datetime import date
from pathlib import Path

import pytest

from kp_pipeline.lock import LockError, Registration, evaluate, frozen_sha256

FROZEN = {"arifnet": {"family": "arifnet", "train": {"L": 250}}, "naive": {"family": "persistence"}}
# The registration file as ARIF-Net wrote it (any bytes; only its sha256 is compared).
REGISTERED = b'{"registered_utc": "2026-11-12T03:00:00+00:00", "env": {"host": "pc"}}'


def registration() -> Registration:
    return Registration(
        registered_utc="2026-11-12T03:00:00+00:00",
        train_end=date(2026, 9, 30),
        cutoff=date(2026, 11, 30),
        frozen_sha256=frozen_sha256(FROZEN),
        registered_file_sha256=hashlib.sha256(REGISTERED).hexdigest(),
    )


def write_opened(folder: Path, **overrides: object) -> None:
    body: dict[str, object] = {
        "opened_utc": "2026-12-03T02:00:00+00:00",
        "finished_utc": "2026-12-03T02:40:00+00:00",
        "dry_run": False,
        "role": "prospektif",
        "frozen": FROZEN,
    }
    body.update(overrides)
    (folder / "OPENED.json").write_text(json.dumps(body), encoding="utf-8")
    (folder / "REGISTERED.json").write_bytes(REGISTERED)


def test_locked_without_proof_of_opening(tmp_path: Path) -> None:
    state = evaluate(registration(), tmp_path)
    assert not state.open
    assert state.data_ceiling == date(2026, 9, 30)
    assert "belum dibuka" in state.reason


def test_open_after_a_finished_real_opening_of_the_registered_models(tmp_path: Path) -> None:
    write_opened(tmp_path)
    state = evaluate(registration(), tmp_path)
    assert state.open
    assert state.data_ceiling is None
    assert state.opened_utc == "2026-12-03T02:00:00+00:00"


@pytest.mark.parametrize(
    ("overrides", "why"),
    [
        ({"finished_utc": None}, "belum selesai"),
        ({"dry_run": True}, "uji coba"),
        ({"role": "test"}, "bukan pembukaan prospektif"),
        ({"frozen": {**FROZEN, "naive": {"family": "changed"}}}, "tidak sama dengan registrasi"),
    ],
)
def test_stays_locked_for_anything_short_of_that(
    tmp_path: Path, overrides: dict[str, object], why: str
) -> None:
    write_opened(tmp_path, **overrides)
    state = evaluate(registration(), tmp_path)
    assert not state.open
    assert why in state.reason
    assert state.data_ceiling == date(2026, 9, 30)


def test_an_unreadable_opening_file_is_an_error_not_an_open_lock(tmp_path: Path) -> None:
    (tmp_path / "OPENED.json").write_text("{bukan json", encoding="utf-8")
    with pytest.raises(LockError):
        evaluate(registration(), tmp_path)


def test_frozen_hash_matches_arifnet_own_comparison() -> None:
    # ARIF-Net compares json.dumps(..., sort_keys=True); key order must not matter.
    reordered = {"naive": FROZEN["naive"], "arifnet": FROZEN["arifnet"]}
    assert frozen_sha256(reordered) == frozen_sha256(FROZEN)


def test_the_committed_registration_summary_loads() -> None:
    reg = Registration.load()
    assert reg.train_end == date(2026, 9, 30)
    assert reg.cutoff == date(2026, 11, 30)
    assert len(reg.frozen_sha256) == 64


def test_the_opening_needs_the_registration_it_belongs_to(tmp_path: Path) -> None:
    # Fase 4B: the frozen hash is public in the repository; the registration file is not.
    write_opened(tmp_path)
    (tmp_path / "REGISTERED.json").unlink()
    state = evaluate(registration(), tmp_path)
    assert not state.open
    assert "REGISTERED.json" in state.reason
    (tmp_path / "REGISTERED.json").write_bytes(REGISTERED + b" ")
    state = evaluate(registration(), tmp_path)
    assert not state.open
    assert "bukan registrasi" in state.reason


def test_the_committed_summary_records_the_registration_file_hash() -> None:
    assert len(Registration.load().registered_file_sha256) == 64
