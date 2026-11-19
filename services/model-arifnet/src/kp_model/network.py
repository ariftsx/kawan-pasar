"""ARIF-Net A0 forward pass in numpy (04_arif_net/model.py, eval mode: no dropout)."""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

from kp_model.spec import FloatArray, Seed, Spec

_erf = np.vectorize(math.erf, otypes=[np.float64])


def gelu(x: FloatArray) -> FloatArray:
    """Exact GELU (PyTorch default): x · Φ(x)."""
    return np.asarray(0.5 * x * (1.0 + _erf(x / math.sqrt(2.0))), dtype=np.float64)


def sigmoid(x: FloatArray | float) -> FloatArray:
    return np.asarray(1.0 / (1.0 + np.exp(-np.asarray(x, dtype=np.float64))), dtype=np.float64)


def softplus(x: FloatArray) -> FloatArray:
    """PyTorch softplus (beta 1, threshold 20)."""
    return np.where(x > 20.0, x, np.log1p(np.exp(np.minimum(x, 20.0))))


@dataclass(frozen=True)
class Output:
    logit: float  # P(r != 0) = sigmoid(logit)
    q: FloatArray  # conditional quantiles at `taus`, in units of r / sigma


class Network:
    def __init__(self, spec: Spec, seed: Seed) -> None:
        m = spec.model
        if m["encoder"] != "gru" or not m["hurdle"] or not m["quantile"]:
            raise ValueError("only the frozen A0 (GRU, hurdle, quantile head) is supported")
        self.w = seed.weights
        self.sigma = seed.sigma
        self.horizons = spec.horizons
        self.drift = bool(m["drift"])
        self.drift_window = int(m["drift_window"])
        self.drift_alpha = float(m["drift_alpha"])
        self.drift_order = spec.features("DRIFT")

    def _linear(self, name: str, x: FloatArray) -> FloatArray:
        return np.asarray(self.w[f"{name}.weight"] @ x + self.w[f"{name}.bias"], dtype=np.float64)

    def _gru(self, seq: FloatArray) -> FloatArray:
        w_ih, w_hh = self.w["enc.weight_ih_l0"], self.w["enc.weight_hh_l0"]
        b_ih, b_hh = self.w["enc.bias_ih_l0"], self.w["enc.bias_hh_l0"]
        d = w_hh.shape[1]
        h = np.zeros(d)
        for x in seq:
            gi = w_ih @ x + b_ih
            gh = w_hh @ h + b_hh
            r = sigmoid(gi[:d] + gh[:d])
            z = sigmoid(gi[d : 2 * d] + gh[d : 2 * d])
            n = np.tanh(gi[2 * d :] + r * gh[2 * d :])
            h = (1.0 - z) * n + z * h
        return h

    def forward(self, seq: FloatArray, x: dict[str, FloatArray], ci: int, hi: int) -> Output:
        h = self._gru(seq)
        t = gelu(self._linear("tab", np.concatenate([x["PRICE"], x["CAL"], x["CALF"]])))
        emb = np.concatenate([self.w["e_c.weight"][ci], self.w["e_h.weight"][hi]])
        z = gelu(self._linear("trunk.0", np.concatenate([h, t, emb])))
        z = gelu(self._linear("trunk.3", z))
        logit = float(self._linear("event", z)[0])
        raw = self._linear("q_head", z)
        mid = len(raw) // 2
        up = np.cumsum(softplus(raw[mid + 1 :]))
        dn = np.cumsum(softplus(raw[:mid][::-1]))[::-1]
        q = np.concatenate([raw[mid] - dn, raw[mid : mid + 1], raw[mid] + up])
        if self.drift:
            d_raw = dict(zip(self.drift_order, x["DRIFT_RAW"], strict=True))
            slope = d_raw["drift_slope_365" if self.drift_window == 365 else "drift_slope_730"]
            horizon = float(self.horizons[hi])
            d = self.drift_alpha * slope * horizon + (1 - self.drift_alpha) * d_raw["drift_season"]
            lam = float(sigmoid(self.w["lam"][ci, hi]))
            q = q + lam * d / float(self.sigma[ci, hi])
        return Output(logit, np.asarray(q, dtype=np.float64))
