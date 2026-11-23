"""How a candidate model is trained and scored (Fase 4A task 6, ruling 4A-5).

Same method as ARIF-Net's validation folds (build_dataset.split_data): train on origins and labels
before the evaluation window (purging), score on one year of origins whose labels are known.
The window ends one year before the data end, so the longest horizon (365 days) is scored too.
While the prospective-test lock holds, the data end is 2026-09-30: no prospective data is used.
"""

from dataclasses import dataclass
from datetime import date

import pandas as pd


@dataclass(frozen=True)
class EvalWindow:
    start: date  # first evaluated origin
    end: date  # first origin after the window

    @staticmethod
    def for_data_end(data_end: date) -> "EvalWindow":
        def years_before(d: date, n: int) -> date:
            # 29 Feb -> 28 Feb in a common year.
            try:
                return d.replace(year=d.year - n)
            except ValueError:
                return d.replace(year=d.year - n, day=28)

        return EvalWindow(start=years_before(data_end, 2), end=years_before(data_end, 1))


def split_eval(full: pd.DataFrame, window: EvalWindow, data_end: date) -> tuple[pd.DataFrame, pd.DataFrame]:
    """(train, evaluation): train origin & label < window start; evaluation origins in the window
    with labels <= data end."""
    origin, label = full["origin_date"], pd.to_datetime(full["label_date"])
    start, end, last = (pd.Timestamp(d) for d in (window.start, window.end, data_end))
    train = full[(origin < start) & (label < start)].copy()
    ev = full[(origin >= start) & (origin < end) & (label <= last)].copy()
    return train, ev


def split_final(full: pd.DataFrame, data_end: date) -> pd.DataFrame:
    """The deployed model's training rows: origin & label <= data end (fit_final's rule)."""
    last = pd.Timestamp(data_end)
    return full[(full["origin_date"] <= last) & (pd.to_datetime(full["label_date"]) <= last)].copy()


def mean_scores(tables: list[pd.DataFrame]) -> dict[str, dict[str, float]]:
    """{comcat_id: {horizon: relMAE}} averaged over seeds (metrics.table rows: komoditas, h, relmae)."""
    both = pd.concat(tables, ignore_index=True)
    means = both.groupby(["komoditas", "h"], sort=True)["relmae"].mean()
    out: dict[str, dict[str, float]] = {}
    for key, v in means.items():
        c, h = key if isinstance(key, tuple) else (key, 0)
        out.setdefault(str(c), {})[str(int(h))] = round(float(v), 4)
    return out
