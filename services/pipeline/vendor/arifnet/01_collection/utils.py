"""
ARIF-Net -- Utilitas bersama untuk tahap collection.

Path, konfigurasi, I/O atomik, dan klien HTTP berasal dari `arifnet_core` agar seluruh tahap memakai perilaku
yang sama (tulis atomik, manifest di-fsync, penantian saat internet terputus). Modul ini menambahkan helper
khusus collection: waktu WIB, parser tanggal media, pencocokan kata kunci, dan URL indeks.
"""
from __future__ import annotations

import hashlib
import re
from datetime import date, datetime, timedelta, timezone
from urllib.parse import urlsplit, urlunsplit

from arifnet_core import settings
from arifnet_core.http import HTTPClient  # noqa: F401  (diekspor ulang untuk collector)
from arifnet_core.io import (  # noqa: F401  (diekspor ulang untuk collector)
    append_csv,
    load_json,
    now_utc,
    read_csv_rows,
    read_raw_gz,
    save_json,
    save_raw_gz,
    sha256_bytes,
    sha256_file,
    stamp,
    write_new,
)
from arifnet_core.logs import setup_logging  # noqa: F401

# ────────────────────────────────────────────── paths
ROOT = settings.ROOT
CONFIG = settings.CONFIG
DATA_RAW = settings.DATA_RAW
DATA_PROCESSED = settings.DATA_PROCESSED
DATA_FINAL = settings.DATA_FINAL
RESULTS = settings.RESULTS
LOGS = settings.LOGS

WIB = timezone(timedelta(hours=7))

MONTHS_ID = {
    "jan": 1, "januari": 1, "feb": 2, "februari": 2, "mar": 3, "maret": 3,
    "apr": 4, "april": 4, "mei": 5, "jun": 6, "juni": 6, "jul": 7, "juli": 7,
    "agu": 8, "ags": 8, "agustus": 8, "agt": 8, "sep": 9, "september": 9,
    "okt": 10, "oktober": 10, "nov": 11, "november": 11, "des": 12, "desember": 12,
}


def load_project_config() -> dict:
    return settings.project()


def load_news_config() -> tuple[dict, dict]:
    return load_json(CONFIG / "news_sources.json"), load_json(CONFIG / "news_scope.json")


def load_locations() -> dict:
    return load_json(CONFIG / "locations.json")


# ────────────────────────────────────────────── time & date
def daterange(start: date, end: date) -> list[date]:
    return [start + timedelta(days=i) for i in range((end - start).days + 1)]


def weekdays(start: date, end: date) -> list[date]:
    return [d for d in daterange(start, end) if d.weekday() < 5]


def month_chunks(start: date, end: date) -> list[tuple[date, date]]:
    """Generate (first_day, last_day) per bulan antara start dan end."""
    chunks = []
    d = start.replace(day=1)
    while d <= end:
        last = (d.replace(month=d.month % 12 + 1, day=1) - timedelta(days=1)
                if d.month < 12 else d.replace(month=12, day=31))
        s = max(d, start)
        e = min(last, end)
        chunks.append((s, e))
        d = last + timedelta(days=1)
    return chunks


def to_wib_iso(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=WIB)
    return dt.astimezone(WIB).strftime("%Y-%m-%dT%H:%M:%S+07:00")


def parse_iso_any(text: str) -> datetime | None:
    """ISO 8601 dengan zona (+00:00, +07:00, Z). Tanpa zona -> None."""
    t = (text or "").strip().replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(t)
    except ValueError:
        return None
    return dt if dt.tzinfo else None


def parse_id_datetime(text: str) -> datetime | None:
    """'Rabu, 02 Jan 2019 22:00 WIB' -> datetime WIB."""
    m = re.search(r"(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})(?:\D+(\d{1,2})[:.](\d{2}))?", text or "")
    if not m or m.group(2).lower() not in MONTHS_ID:
        return None
    hh, mi = (int(m.group(4)), int(m.group(5))) if m.group(4) else (0, 0)
    return datetime(int(m.group(3)), MONTHS_ID[m.group(2).lower()], int(m.group(1)), hh, mi, tzinfo=WIB)


def kompas_url_time(url: str) -> datetime | None:
    """/read/YYYY/MM/DD/HHMMSSxxx/ -> WIB."""
    m = re.search(r"/read/(\d{4})/(\d{2})/(\d{2})/(\d{2})(\d{2})(\d{2})\d*", url)
    if not m:
        return None
    y, mo, d, hh, mi, ss = map(int, m.groups())
    if hh > 23 or mi > 59 or ss > 59:
        return None
    return datetime(y, mo, d, hh, mi, ss, tzinfo=WIB)


# ────────────────────────────────────────────── URL helpers
def canonical_url(url: str) -> str:
    parts = urlsplit(url.strip())
    return urlunsplit(("https", parts.netloc.lower(), parts.path.rstrip("/"), "", ""))


def article_id(url: str) -> str:
    return hashlib.sha1(canonical_url(url).encode("utf-8"), usedforsecurity=False).hexdigest()


def build_index_url(template: str, d: date, page: int, per_page: int) -> str:
    """Bangun URL indeks dari template dengan token tanggal & paginasi."""
    tokens = {
        "date_iso": d.isoformat(),
        "date_next_iso": (d + timedelta(days=1)).isoformat(),
        "date_mdy_enc": f"{d:%m}%2F{d:%d}%2F{d:%Y}",
        "date_ymd_slash": f"{d:%Y/%m/%d}",
        "yyyy": f"{d:%Y}", "mm": f"{d:%m}", "dd": f"{d:%d}", "d": str(d.day),
        "page": str(page), "offset": str((page - 1) * per_page),
    }
    return template.format(**tokens)


# ────────────────────────────────────────────── keyword matching (relevansi berita)
class KeywordMatcher:
    """Cocokkan kata kunci pada teks (case-insensitive, batas kata)."""

    def __init__(self, topics: dict[str, list[str]]):
        self.rules = [
            (topic, kw, re.compile(r"(?<![0-9a-z])" + re.escape(kw.lower()) + r"(?![0-9a-z])"))
            for topic, keywords in topics.items()
            for kw in keywords
        ]

    def match(self, text: str) -> tuple[list[str], list[str]]:
        """Return (topics_matched, keywords_matched)."""
        low = (text or "").lower()
        hits = [(t, kw) for t, kw, rx in self.rules if rx.search(low)]
        return sorted({t for t, _ in hits}), sorted({kw for _, kw in hits})

    def is_relevant(self, text: str) -> bool:
        topics, _ = self.match(text)
        return bool(topics)


class RegionMatcher:
    """Cocokkan nama kabupaten pemasok di teks."""

    def __init__(self, locations: list[dict]):
        names = sorted(
            ((loc["kabupaten"].replace("Kabupaten ", "").lower(), loc["location_id"])
             for loc in locations),
            key=lambda x: -len(x[0])
        )
        self.rules = [
            (lid, re.compile(r"(?<![0-9a-z])" + re.escape(n) + r"(?![0-9a-z])"))
            for n, lid in names
        ]

    def match(self, title: str) -> list[str]:
        low, hits = (title or "").lower(), []
        for lid, rx in self.rules:
            if rx.search(low):
                hits.append(lid)
                low = rx.sub(" ", low)
        return sorted(hits)
