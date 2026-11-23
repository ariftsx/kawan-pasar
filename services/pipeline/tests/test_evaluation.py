"""Task 6: the candidate's evaluation window (ARIF-Net fold method) and score aggregation."""

from datetime import date

import pandas as pd
import pytest

from kp_pipeline.evaluation import EvalWindow, mean_scores, split_eval, split_final


def _frame(rows: list[tuple[str, int, str, str]]) -> pd.DataFrame:
    return pd.DataFrame(
        {
            "comcat_id": [r[0] for r in rows],
            "h": [r[1] for r in rows],
            "origin_date": pd.to_datetime([r[2] for r in rows]),
            "label_date": pd.to_datetime([r[3] for r in rows]),
        }
    )


def test_the_window_is_one_year_of_origins_two_years_before_the_data_end() -> None:
    w = EvalWindow.for_data_end(date(2026, 9, 30))
    assert (w.start, w.end) == (date(2024, 9, 30), date(2025, 9, 30))


def test_training_rows_are_purged_and_evaluation_labels_stay_within_the_data_end() -> None:
    full = _frame(
        [
            ("com_14", 1, "2024-09-27", "2024-09-30"),  # label at the window start: purged
            ("com_14", 1, "2024-09-26", "2024-09-27"),  # train
            ("com_14", 365, "2023-10-02", "2024-10-01"),  # label inside the window: purged
            ("com_14", 1, "2024-09-30", "2024-10-01"),  # evaluation
            ("com_14", 365, "2025-09-29", "2026-09-29"),  # evaluation (h=365, label <= end)
            ("com_14", 365, "2025-09-30", "2026-09-30"),  # origin at window end: not evaluated
            ("com_14", 1, "2026-09-30", "2026-10-01"),  # label after the data end: never
        ]
    )
    w = EvalWindow.for_data_end(date(2026, 9, 30))
    train, ev = split_eval(full, w, date(2026, 9, 30))
    assert train["label_date"].max() < pd.Timestamp("2024-09-30")
    assert list(train["origin_date"].dt.date.astype(str)) == ["2024-09-26"]
    assert list(ev["origin_date"].dt.date.astype(str)) == ["2024-09-30", "2025-09-29"]


def test_final_training_uses_everything_up_to_the_data_end_and_nothing_after() -> None:
    full = _frame(
        [
            ("com_14", 1, "2026-09-29", "2026-09-30"),
            ("com_14", 1, "2026-09-30", "2026-10-01"),
        ]
    )
    final = split_final(full, date(2026, 9, 30))
    assert list(final["label_date"].dt.date.astype(str)) == ["2026-09-30"]


def test_scores_are_the_mean_over_seeds_per_commodity_and_horizon() -> None:
    seed0 = pd.DataFrame({"komoditas": ["com_14", "com_14"], "h": [1, 7], "relmae": [0.8, 1.1]})
    seed1 = pd.DataFrame({"komoditas": ["com_14", "com_14"], "h": [1, 7], "relmae": [0.6, 0.9]})
    assert mean_scores([seed0, seed1]) == {"com_14": {"1": pytest.approx(0.7), "7": pytest.approx(1.0)}}
