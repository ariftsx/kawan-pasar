"""Ensemble forecast of the five ARIF-Net A0 seeds from the last observation of each commodity."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

import numpy as np

from kp_model.calendar import HolidayCalendar
from kp_model.features import (
    Series,
    drift_features,
    preprocess,
    price_features,
    price_sequence,
)
from kp_model.network import Network, sigmoid
from kp_model.spec import FloatArray, Spec

MARKET = "PIKJ"  # the only market ARIF-Net was trained on


@dataclass(frozen=True)
class ForecastRow:
    commodity_code: str
    base_date: date
    horizon_days: int
    q10_change: float
    q50_change: float
    q90_change: float
    q10_price_idr: int
    q50_price_idr: int
    q90_price_idr: int
    eval_status: str


def mixture_quantile(p: float, q: FloatArray, level: float, taus: list[float]) -> float:
    """Quantile `level` of F(x) = (1 - p)·1[x ≥ 0] + p·G(x): "no change" with probability 1 - p,
    otherwise the conditional distribution G given by quantiles `q` at `taus` (linear between them,
    flat outside). Generalises ARIF-Net's mixture_median (SPEC §2.5) to any level."""
    p = float(np.clip(p, 1e-9, 1.0))
    t = np.asarray(taus, dtype=np.float64)
    if q[-1] < 0:
        g0 = 1.0
    elif q[0] >= 0:
        g0 = 0.0
    else:
        g0 = float(np.interp(0.0, q, t))
    below = p * g0  # F(0⁻)
    if below >= level:
        return float(np.interp(level / p, t, q))
    if below + (1 - p) >= level:
        return 0.0
    return float(np.interp((level - (1 - p)) / p, t, q))


def _round6(x: float) -> float:
    r = round(x, 6)
    return 0.0 if r == 0 else r  # never "-0.0" in the bundle


def forecast(spec: Spec, series: dict[str, Series], calendar: HolidayCalendar) -> list[ForecastRow]:
    """One row per (commodity, horizon). Each seed gives mixture quantiles; the ensemble is their
    mean per level (quantile averaging), then sorted so q10 ≤ q50 ≤ q90 always holds."""
    nets = [Network(spec, s) for s in spec.seeds]
    rows: list[ForecastRow] = []
    for cid in spec.commodity_ids:
        s = series.get(cid)
        if s is None:
            raise ValueError(f"no prices for {spec.product_code(cid)}")
        origin = date.fromordinal(int(s.days[-1]))
        base_price = float(s.prices[-1])
        ci = spec.commodity_index(cid)
        seq = price_sequence(s, origin, spec.L)
        common = {**price_features(s, origin), **calendar.features(origin, "cal_")}
        for hi, h in enumerate(spec.horizons):
            raw = {
                **common,
                **calendar.features(origin + timedelta(days=h), "tgt_cal_"),
                **drift_features(s, origin, h),
            }
            x = preprocess(spec, cid, raw)
            levels = np.zeros((len(nets), 3))
            for k, net in enumerate(nets):
                out = net.forward(seq, x, ci, hi)
                p = float(sigmoid(out.logit))
                q = out.q * float(net.sigma[ci, hi])
                levels[k] = [mixture_quantile(p, q, lvl, spec.taus) for lvl in (0.1, 0.5, 0.9)]
            q10, q50, q90 = (_round6(v) for v in sorted(levels.mean(axis=0)))
            price = [max(1, round(base_price * (1 + c))) for c in (q10, q50, q90)]
            rows.append(
                ForecastRow(
                    commodity_code=spec.product_code(cid),
                    base_date=origin,
                    horizon_days=h,
                    q10_change=q10,
                    q50_change=q50,
                    q90_change=q90,
                    q10_price_idr=price[0],
                    q50_price_idr=price[1],
                    q90_price_idr=price[2],
                    # Owner ruling K2: "available" only where ARIF-Net beat "price unchanged"
                    # in validation; elsewhere "partial". The prospective test is still to come.
                    eval_status="available" if spec.relmae(cid, h) < 1 else "partial",
                )
            )
    return rows
