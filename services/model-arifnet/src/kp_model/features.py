"""Model inputs at one origin date, exactly as ARIF-Net computes them, from prices <= origin.

Mirrors 02_preprocessing/build_dataset.py (price and drift features), 03_training/data.py
(sequence bank and standardisation). Only observations on or before the origin are read.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import date

import numpy as np
import numpy.typing as npt

from kp_model.spec import FloatArray, Spec

NAN = float("nan")
RETURN_LAGS = (1, 2, 3, 5, 7, 14, 21, 30)
MA_WINDOWS = (5, 10, 20, 30, 60, 90)
VOL_WINDOWS = (5, 20)
LEVEL_LAGS = (1, 7, 30)
LEVEL_MAS = (5, 20, 60)
DRIFT_WINDOWS = (365, 730)
DRIFT_SEASON_YEARS = 3
DRIFT_MIN_OBS = 20
SEQ_CHANNELS = 4


@dataclass(frozen=True)
class Series:
    """Reported observations of one commodity: ascending, unique days (ordinal), prices > 0."""

    days: npt.NDArray[np.int64]
    prices: FloatArray

    @staticmethod
    def from_rows(rows: list[tuple[date, float]]) -> Series:
        rows = sorted(rows)
        days = np.array([d.toordinal() for d, _ in rows], dtype=np.int64)
        if len(days) == 0 or np.any(np.diff(days) <= 0):
            raise ValueError("a series needs at least one observation and unique days")
        prices = np.array([p for _, p in rows], dtype=np.float64)
        if np.any(~np.isfinite(prices)) or np.any(prices <= 0):
            raise ValueError("prices must be positive numbers")
        return Series(days, prices)

    def upto(self, origin: date) -> int:
        """Number of observations on or before `origin`."""
        return int(np.searchsorted(self.days, origin.toordinal(), side="right"))


def _std(x: FloatArray) -> float:
    x = x[np.isfinite(x)]
    return float(np.std(x, ddof=1)) if len(x) >= 2 else NAN


def price_features(s: Series, origin: date) -> dict[str, float]:
    """build_price_features at the origin row (pandas rolling windows count observations)."""
    n = s.upto(origin)
    if n == 0:
        raise ValueError("no observation on or before the origin")
    p = s.prices[:n]
    i = n - 1
    out: dict[str, float] = {"price_level": math.log(p[i])}
    for k in RETURN_LAGS:
        out[f"return_{k}d"] = p[i] / p[i - k] - 1 if i - k >= 0 else NAN
    for w in MA_WINDOWS:
        win = p[max(0, i - w + 1) : i + 1]
        ma = float(np.mean(win))
        out[f"price_ratio_ma_{w}"] = p[i] / ma - 1
        out[f"price_cv_{w}"] = _std(win) / ma
    r1 = np.concatenate([[NAN], p[1:] / p[:-1] - 1])
    for w in VOL_WINDOWS:
        out[f"volatility_{w}d"] = _std(r1[max(0, i - w + 1) : i + 1])
    for k in LEVEL_LAGS:
        out[f"price_lag_{k}"] = float(p[i - k]) if i - k >= 0 else NAN
    for w in LEVEL_MAS:
        out[f"price_ma_{w}"] = float(np.mean(p[max(0, i - w + 1) : i + 1]))
    return out


def theil_sen_slope(y: FloatArray, x: FloatArray) -> float:
    """Median of all pairwise slopes (scipy.stats.theilslopes, NaN-omitting median)."""
    i, j = np.triu_indices(len(x), k=1)
    dx = x[i] - x[j]
    dy = y[i] - y[j]
    ok = dx != 0
    return float(np.median(dy[ok] / dx[ok])) if np.any(ok) else NAN


def drift_features(s: Series, origin: date, h: int) -> dict[str, float]:
    t = origin.toordinal()
    lp = np.log(s.prices)
    i = s.upto(origin)
    out: dict[str, float] = {}
    for w in DRIFT_WINDOWS:
        j = int(np.searchsorted(s.days, t - w, side="right"))
        out[f"drift_slope_{w}"] = (
            theil_sen_slope(lp[j:i], s.days[j:i].astype(np.float64)) if i - j >= DRIFT_MIN_OBS else NAN
        )

    def asof(day: int) -> float:
        k = int(np.searchsorted(s.days, day, side="right")) - 1
        return float(lp[k]) if k >= 0 else NAN

    acc, count = 0.0, 0
    for k in range(1, DRIFT_SEASON_YEARS + 1):
        base = t - 365 * k
        v = asof(base + h) - asof(base)
        if math.isfinite(v) and base >= s.days[0]:
            acc += v
            count += 1
    out["drift_season"] = acc / count if count > 0 else NAN
    return out


def preprocess(spec: Spec, commodity_id: str, raw: dict[str, float]) -> dict[str, FloatArray]:
    """Standardise with the training statistics (median fill, z-score, clip); drift stays raw."""
    out: dict[str, FloatArray] = {}
    clip = float(spec.raw["z_clip"])
    for group in ("PRICE", "CAL", "CALF"):
        x = np.array([raw[c] for c in spec.features(group)], dtype=np.float64)
        med, mu, sd = spec.stats(group, commodity_id)
        x = np.where(np.isfinite(x), x, med)
        out[group] = np.clip((x - mu) / sd, -clip, clip).astype(np.float32).astype(np.float64)
    d = np.array([raw[c] for c in spec.features("DRIFT")], dtype=np.float64)
    out["DRIFT_RAW"] = np.nan_to_num(d.astype(np.float32), nan=0.0).astype(np.float64)
    return out


def price_sequence(s: Series, origin: date, L: int) -> FloatArray:  # noqa: N803
    """SequenceBank.price_seq: last L observations (rel. log price, return, gap/7, mask)."""
    i = s.upto(origin)
    j = max(0, i - L)
    days, lp = s.days[j:i], np.log(s.prices[j:i])
    out = np.zeros((L, SEQ_CHANNELS), dtype=np.float32)
    n = len(days)
    if n == 0:
        return out.astype(np.float64)
    all_lp = np.log(s.prices)
    prev_d, prev_lp = (s.days[j - 1], all_lp[j - 1]) if j > 0 else (days[0], lp[0])
    ret = np.diff(np.concatenate([[prev_lp], lp]))
    gap = np.diff(np.concatenate([[prev_d], days])).astype(np.float64)
    out[-n:, 0] = lp - all_lp[i - 1]
    out[-n:, 1] = ret
    out[-n:, 2] = gap / 7.0
    out[-n:, 3] = 1.0
    return out.astype(np.float64)
