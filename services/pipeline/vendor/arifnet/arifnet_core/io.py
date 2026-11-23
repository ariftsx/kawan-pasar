"""I/O tahan gangguan: tulis atomik, append CSV yang di-fsync, dan pembaca manifest yang toleran.

Prinsip: berkas keluaran tidak pernah berada dalam keadaan setengah tertulis. Data ditulis ke berkas sementara
di folder yang sama, di-fsync, lalu diganti dengan `os.replace` (atomik di Windows dan POSIX). Bila komputer mati
di tengah penulisan, yang tersisa adalah berkas lama yang utuh atau berkas baru yang utuh.
"""
from __future__ import annotations

import contextlib
import csv
import gzip
import hashlib
import io
import json
import os
import tempfile
import time
from collections.abc import Iterable, Iterator
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

csv.field_size_limit(2**31 - 1)


def now_utc() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def stamp() -> str:
    return datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")


def _fsync_dir(path: Path) -> None:
    if os.name == "nt":                                    # Windows tidak mendukung fsync direktori
        return
    try:
        fd = os.open(path, os.O_RDONLY)
    except OSError:
        return
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def _replace(src: str, dst: Path, attempts: int = 20) -> None:
    """os.replace dengan percobaan ulang (Windows: berkas tujuan bisa terkunci sesaat oleh antivirus/indeks)."""
    for i in range(attempts):
        try:
            os.replace(src, dst)
            return
        except PermissionError:
            if i == attempts - 1:
                raise
            time.sleep(0.25 * (i + 1))


def atomic_write_bytes(path: Path, data: bytes) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    try:
        with contextlib.suppress(OSError):
            os.chmod(tmp, 0o644)                           # mkstemp membuat 0600; samakan dengan berkas biasa
        with os.fdopen(fd, "wb") as fh:
            fh.write(data)
            fh.flush()
            os.fsync(fh.fileno())
        _replace(tmp, path)
        _fsync_dir(path.parent)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise
    return path


def atomic_write_text(path: Path, text: str) -> Path:
    return atomic_write_bytes(path, text.encode("utf-8"))


def save_json(path: Path, obj: Any, indent: int | None = 2) -> Path:
    return atomic_write_text(path, json.dumps(obj, indent=indent, ensure_ascii=False, default=str) + "\n")


def load_json(path: Path, default: Any = None) -> Any:
    path = Path(path)
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def save_df(df, path: Path, **kwargs) -> Path:
    """DataFrame → CSV secara atomik."""
    buf = io.StringIO()
    df.to_csv(buf, index=kwargs.pop("index", False), **kwargs)
    return atomic_write_text(path, buf.getvalue())


def write_csv_rows(path: Path, fields: list[str], rows: Iterable[dict]) -> Path:
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=fields, extrasaction="ignore")
    w.writeheader()
    w.writerows(rows)
    return atomic_write_text(path, buf.getvalue())


def append_csv(path: Path, fields: list[str], row: dict) -> None:
    """Tambah satu baris manifest dan paksa ke disk (fsync).

    Bila komputer mati saat menulis, paling banyak satu baris terakhir terpotong; `read_csv_rows` membuang baris
    terpotong itu sehingga entri tersebut dianggap belum selesai dan dikerjakan ulang.
    """
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    new = not path.exists() or path.stat().st_size == 0
    if not new:
        _ensure_trailing_newline(path)
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=fields, extrasaction="ignore")
    if new:
        w.writeheader()
    w.writerow({k: row.get(k, "") for k in fields})
    with path.open("a", newline="", encoding="utf-8") as fh:
        fh.write(buf.getvalue())
        fh.flush()
        os.fsync(fh.fileno())


def _ensure_trailing_newline(path: Path) -> None:
    """Baris terakhir yang terpotong (tanpa newline) ditutup agar baris baru tidak tersambung ke sampah."""
    with path.open("rb+") as fh:
        fh.seek(0, os.SEEK_END)
        if fh.tell() == 0:
            return
        fh.seek(-1, os.SEEK_END)
        if fh.read(1) not in (b"\n", b"\r"):
            fh.write(b"\n")
            fh.flush()
            os.fsync(fh.fileno())


def read_csv_rows(path: Path, required: Iterable[str] = ()) -> Iterator[dict]:
    """Baca manifest CSV; baris rusak (kolom kurang, terpotong, NUL) dilewati."""
    path = Path(path)
    if not path.exists():
        return
    required = tuple(required)
    with path.open(encoding="utf-8", errors="replace", newline="") as fh:
        reader = csv.DictReader(line.replace("\0", "") for line in fh)
        n_fields = len(reader.fieldnames or [])
        for row in reader:
            if row is None or None in row or len(row) != n_fields or any(v is None for v in row.values()):
                continue
            if any(not row.get(k) for k in required):
                continue
            yield row


# ─────────────────────────────────────────── hash & raw evidence
def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with Path(path).open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def write_new(path: Path, data: bytes | str) -> Path:
    """Tulis berkas bukti baru tanpa menimpa yang ada (suffix .v2, .v3, …), secara atomik."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    target, n = path, 1
    while target.exists():
        n += 1
        target = path.with_name(f"{path.stem}.v{n}{path.suffix}")
    payload = data if isinstance(data, bytes) else data.encode("utf-8")
    return atomic_write_bytes(target, payload)


def save_raw_gz(path: Path, data: bytes) -> Path:
    """Simpan bytes respons ter-gzip tanpa menimpa berkas yang ada, secara atomik."""
    path = Path(path)
    target, n = path, 1
    while target.exists():
        n += 1
        target = path.with_name(f"{path.stem}.r{n}.gz")
    return atomic_write_bytes(target, gzip.compress(data, mtime=0))


def read_raw_gz(path: Path) -> bytes:
    return gzip.decompress(Path(path).read_bytes())
