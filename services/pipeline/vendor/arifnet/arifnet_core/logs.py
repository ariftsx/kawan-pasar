"""Logging seragam: konsol + berkas per tahap di `logs/`, aman untuk konsol Windows."""
from __future__ import annotations

import logging
import sys
from pathlib import Path

from .io import stamp
from .settings import LOGS

FORMAT = "%(asctime)s | %(name)-14s | %(levelname)-7s | %(message)s"


def _utf8_streams() -> None:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass


def setup_logging(name: str, log_dir: Path | None = None, level: int = logging.INFO) -> Path:
    """Pasang handler konsol + berkas `logs/<name>_<UTC>.log`. Aman dipanggil berulang."""
    _utf8_streams()
    log_dir = Path(log_dir or LOGS)
    log_dir.mkdir(parents=True, exist_ok=True)
    logfile = log_dir / f"{name}_{stamp()}.log"
    root = logging.getLogger()
    for h in list(root.handlers):
        root.removeHandler(h)
    fmt = logging.Formatter(FORMAT)
    console = logging.StreamHandler()
    console.setFormatter(fmt)
    fileh = logging.FileHandler(logfile, encoding="utf-8")
    fileh.setFormatter(fmt)
    root.addHandler(console)
    root.addHandler(fileh)
    root.setLevel(level)
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.info("Log: %s", logfile)
    return logfile
