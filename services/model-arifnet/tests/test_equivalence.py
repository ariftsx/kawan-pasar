"""The numpy inference must reproduce the ARIF-Net code (tests/fixtures/golden.json)."""

from __future__ import annotations

import json
import math
from datetime import date
from pathlib import Path
from typing import Any

import numpy as np
import pytest

from kp_model.calendar import HolidayCalendar
from kp_model.features import Series, drift_features, preprocess, price_features, price_sequence
from kp_model.network import Network
from kp_model.spec import load_spec

GOLDEN: dict[str, Any] = json.loads(
    (Path(__file__).parent / "fixtures" / "golden.json").read_text(encoding="utf-8")
)
SPEC = load_spec()
CALENDAR = HolidayCalendar.bundled(include_estimates=False)  # the reference has no estimates


def series_of(commodity: str) -> Series:
    rows = GOLDEN["series"][commodity]
    return Series.from_rows([(date.fromisoformat(d), float(p)) for d, p in rows])


def close(a: float | None, b: float | None, tol: float = 1e-9) -> bool:
    if a is None or b is None or (isinstance(a, float) and math.isnan(a)):
        return (a is None or math.isnan(a)) and (b is None or math.isnan(b))
    return abs(a - b) <= tol * max(1.0, abs(b))


CASES = GOLDEN["cases"]


@pytest.mark.parametrize("case", CASES, ids=lambda c: f"{c['commodity']}-{c['origin']}-h{c['h']}")
def test_features_match_arifnet(case: dict[str, Any]) -> None:
    s = series_of(case["commodity"])
    origin = date.fromisoformat(case["origin"])
    h = int(case["h"])
    mine: dict[str, float] = {}
    mine.update(price_features(s, origin))
    mine.update(CALENDAR.features(origin, "cal_"))
    mine.update(CALENDAR.features(date.fromordinal(origin.toordinal() + h), "tgt_cal_"))
    mine.update(drift_features(s, origin, h))
    for name, expected in case["features"].items():
        assert close(mine[name], expected), (name, mine[name], expected)


@pytest.mark.parametrize("case", CASES, ids=lambda c: f"{c['commodity']}-{c['origin']}-h{c['h']}")
def test_inputs_and_outputs_match_arifnet(case: dict[str, Any]) -> None:
    s = series_of(case["commodity"])
    origin = date.fromisoformat(case["origin"])
    raw = {
        **price_features(s, origin),
        **CALENDAR.features(origin, "cal_"),
        **CALENDAR.features(date.fromordinal(origin.toordinal() + int(case["h"])), "tgt_cal_"),
        **drift_features(s, origin, int(case["h"])),
    }
    x = preprocess(SPEC, case["commodity"], raw)
    for group in ("PRICE", "CAL", "CALF"):
        np.testing.assert_allclose(x[group], case["x"][group], rtol=1e-6, atol=1e-6)
    np.testing.assert_allclose(x["DRIFT_RAW"], case["drift_raw"], rtol=1e-6, atol=1e-7)
    seq = price_sequence(s, origin, SPEC.L)
    np.testing.assert_allclose(seq, case["seq"], rtol=1e-6, atol=1e-6)

    ci = SPEC.commodity_index(case["commodity"])
    hi = SPEC.horizons.index(int(case["h"]))
    for seed, expected in zip(SPEC.seeds, case["seeds"], strict=True):
        out = Network(SPEC, seed).forward(seq, x, ci, hi)
        assert abs(out.logit - expected["logit"]) < 2e-5
        np.testing.assert_allclose(out.q, expected["q"], atol=2e-5)
