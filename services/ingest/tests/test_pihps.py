"""Fase 4A: PIHPS prices produced by the retraining pipeline (ARIF-Net's prices_combined.csv)."""

from datetime import date
from pathlib import Path

from kp_ingest.models import RawPriceRow
from kp_ingest.sources.base import RowError
from kp_ingest.sources.pihps import PihpsSource


def _csv(tmp_path: Path, *rows: str) -> Path:
    path = tmp_path / "prices_combined.csv"
    path.write_text(
        "comcat_id,commodity,date,price\n" + "".join(f"{r}\n" for r in rows), encoding="utf-8"
    )
    return path


def test_rows_are_labelled_as_pihps() -> None:
    assert PihpsSource(Path("x.csv"), ceiling=None).kind == "pihps"


def test_reads_the_pipeline_output_like_the_seed_export(tmp_path: Path) -> None:
    path = _csv(
        tmp_path, "com_14,Cabai Merah Keriting,2026-09-29,63000.0", "com_3,Beras,2026-09-30,15950.0"
    )
    rows = list(PihpsSource(path, ceiling=date(2026, 9, 30)).rows())
    assert all(isinstance(r, RawPriceRow) for r in rows)
    assert [(r.source_ref, r.price_idr) for r in rows if isinstance(r, RawPriceRow)] == [
        ("com_14", 63000),
        ("com_3", 15950),
    ]


def test_nothing_after_the_prospective_test_ceiling_gets_in(tmp_path: Path) -> None:
    # Defence in depth: the pipeline already stops at the ceiling (protocol lock, Fase 4).
    path = _csv(
        tmp_path,
        "com_14,Cabai Merah Keriting,2026-09-30,63000",
        "com_14,Cabai Merah Keriting,2026-10-01,64000",
    )
    rows = list(PihpsSource(path, ceiling=date(2026, 9, 30)).rows())
    assert isinstance(rows[0], RawPriceRow)
    assert isinstance(rows[1], RowError)
    assert rows[1].line == 3
    assert rows[1].reason == "observed_on: after the data ceiling (prospective-test lock)"
    # The reason never echoes the row (date or price).
    assert "2026-10-01" not in rows[1].reason


def test_without_a_ceiling_every_valid_row_is_read(tmp_path: Path) -> None:
    path = _csv(tmp_path, "com_14,Cabai Merah Keriting,2026-11-20,70000")
    assert isinstance(next(iter(PihpsSource(path, ceiling=None).rows())), RawPriceRow)
