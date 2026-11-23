"""
ARIF-Net — checkpoint pelatihan per epoch agar run yang terputus dapat dilanjutkan secara identik.

`runs.run` membuka `scope(<results/checkpoints/run-key>)`; setiap pemanggilan `trainer.fit` / ARIF-Net `fit` di dalam
scope memperoleh berkas checkpoint berurutan (`_fit1.pt`, `_fit2.pt`, …; urutan deterministik, termasuk ensembel
gerbang X-1 dan TCN-XGBoost). Sesudah setiap epoch disimpan: bobot model, state optimizer, state RNG torch & NumPy,
riwayat loss, dan kurva checkpoint. Melanjutkan dari checkpoint menghasilkan bobot dan prediksi yang sama persis
dengan run tanpa gangguan pada mesin & versi pustaka yang sama. Berkas dihapus sesudah run tersimpan lengkap.
"""
from __future__ import annotations

import contextlib
import hashlib
import json
import os
import tempfile
from pathlib import Path

import torch

_state = {"base": None, "n": 0}


def run_key(**parts) -> str:
    return hashlib.sha1(json.dumps(parts, sort_keys=True, default=str).encode("utf-8"), usedforsecurity=False).hexdigest()[:20]


@contextlib.contextmanager
def scope(base: Path | None):
    prev = dict(_state)
    _state.update(base=Path(base) if base else None, n=0)
    try:
        yield
    finally:
        _state.update(prev)


def next_path() -> Path | None:
    if _state["base"] is None:
        return None
    _state["n"] += 1
    return _state["base"].with_name(f"{_state['base'].name}_fit{_state['n']}.pt")


def save(path: Path | None, state: dict) -> None:
    if path is None:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    os.close(fd)
    try:
        torch.save(state, tmp)
        with open(tmp, "r+b") as fh:
            os.fsync(fh.fileno())
        os.replace(tmp, path)
    except BaseException:
        with contextlib.suppress(OSError):
            os.unlink(tmp)
        raise


def load(path: Path | None) -> dict | None:
    if path is None or not path.exists():
        return None
    try:
        return torch.load(path, map_location="cpu", weights_only=False)
    except Exception:                                                # noqa: BLE001 — berkas rusak → mulai ulang
        return None


def clear(base: Path | None) -> None:
    if base is None:
        return
    base = Path(base)
    for f in base.parent.glob(f"{base.name}_fit*.pt"):
        with contextlib.suppress(OSError):
            f.unlink()


def snapshot(model, opt, rng, epoch: int, hist: list, curve: list, elapsed: float) -> dict:
    return {"epoch": epoch, "model": model.state_dict(), "opt": opt.state_dict(), "torch_rng": torch.get_rng_state(),
            "np_rng": rng.bit_generator.state, "hist": hist, "curve": curve, "elapsed": elapsed}


def restore(st: dict, model, opt, rng) -> tuple[int, list, list, float]:
    model.load_state_dict(st["model"])
    opt.load_state_dict(st["opt"])
    torch.set_rng_state(st["torch_rng"])
    rng.bit_generator.state = st["np_rng"]
    return int(st["epoch"]), list(st["hist"]), list(st["curve"]), float(st["elapsed"])
