"""The converted ARIF-Net A0 model (model/arifnet-a0.json + weights), verified before use."""

from __future__ import annotations

import hashlib
import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import numpy.typing as npt

FloatArray = npt.NDArray[np.float64]

DEFAULT_DIR = Path(__file__).resolve().parents[2] / "model"


def resolve_model_dir() -> Path:
    """KP_MODEL_DIR (set in the image), else the repository copy (development, tests)."""
    return Path(os.environ.get("KP_MODEL_DIR", str(DEFAULT_DIR)))


class ModelIntegrityError(Exception):
    """A weight file does not match the sha256 recorded at conversion."""


@dataclass(frozen=True)
class Seed:
    seed: int
    sigma: FloatArray  # (commodities, horizons): scale of r per (c, h)
    weights: dict[str, FloatArray]


@dataclass(frozen=True)
class Spec:
    raw: dict[str, Any]
    seeds: tuple[Seed, ...]

    @property
    def L(self) -> int:  # noqa: N802 - the paper's name for the sequence length
        return int(self.raw["L"])

    @property
    def horizons(self) -> list[int]:
        return [int(h) for h in self.raw["horizons"]]

    @property
    def taus(self) -> list[float]:
        return [float(t) for t in self.raw["taus"]]

    @property
    def model(self) -> dict[str, Any]:
        return dict(self.raw["model"])

    @property
    def commodity_ids(self) -> list[str]:
        return [str(c["id"]) for c in self.raw["commodities"]]

    def commodity_index(self, commodity_id: str) -> int:
        return self.commodity_ids.index(commodity_id)

    def product_code(self, commodity_id: str) -> str:
        return next(str(c["code"]) for c in self.raw["commodities"] if c["id"] == commodity_id)

    def commodity_for_code(self, code: str) -> str | None:
        return next((str(c["id"]) for c in self.raw["commodities"] if c["code"] == code), None)

    def features(self, group: str) -> list[str]:
        return [str(f) for f in self.raw["features"][group]]

    def stats(self, group: str, commodity_id: str) -> tuple[FloatArray, FloatArray, FloatArray]:
        s = self.raw["preprocess"][group][commodity_id]
        return (np.asarray(s["med"], float), np.asarray(s["mu"], float), np.asarray(s["sd"], float))

    def relmae(self, commodity_id: str, horizon: int) -> float:
        return float(self.raw["validation"]["by_commodity"][commodity_id][str(horizon)])


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_spec(model_dir: Path | None = None) -> Spec:
    """Loads the model; every weight file is checked against its recorded sha256 first."""
    root = model_dir or resolve_model_dir()
    raw: dict[str, Any] = json.loads((root / "arifnet-a0.json").read_text(encoding="utf-8"))
    seeds = []
    for entry in raw["seeds"]:
        path = root / entry["file"]
        if _sha256(path) != entry["sha256"]:
            raise ModelIntegrityError(f"{entry['file']}: sha256 does not match the model spec")
        # allow_pickle=False: a weight file can only hold plain arrays, never code.
        with np.load(path, allow_pickle=False) as npz:
            weights = {k: np.asarray(npz[k], dtype=np.float64) for k in npz.files}
        seeds.append(Seed(int(entry["seed"]), np.asarray(entry["sigma"], float), weights))
    return Spec(raw, tuple(seeds))
