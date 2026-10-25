"""Holds the bundle being served and swaps it atomically on reload (docs 13 §B3)."""

import asyncio
from pathlib import Path
from typing import Literal

import structlog

from app.artifacts.loader import DEMO_BUNDLE, Bundle, BundleError, Mode, load_bundle

OutlookStatus = Literal["available", "candidate", "in_development", "missing"]

log = structlog.get_logger()


class ArtifactStore:
    def __init__(self, mode: Mode, artifacts_dir: Path) -> None:
        self.mode: Mode = mode
        self._artifacts_dir = artifacts_dir
        self._bundle: Bundle | None = None
        self._lock = asyncio.Lock()

    @property
    def bundle(self) -> Bundle | None:
        return self._bundle

    def _source(self) -> Path:
        if self.mode == "development":
            return DEMO_BUNDLE
        # `current` is a symlink to releases/<bundle_id>; the folder name must match the id.
        return (self._artifacts_dir / "current").resolve()

    @property
    def status(self) -> OutlookStatus:
        if self._bundle is None:
            return "missing"
        if self.mode == "development":
            return "in_development"
        return "candidate" if self._bundle.manifest.artifact_status == "candidate" else "available"

    async def reload(self) -> Bundle:
        """Verifies the new bundle off the event loop; on failure the old one stays served."""
        async with self._lock:
            bundle = await asyncio.to_thread(load_bundle, self._source(), self.mode)
            self._bundle = bundle
            log.info("bundle loaded", bundle_id=bundle.manifest.bundle_id, mode=self.mode)
            return bundle

    async def load_at_startup(self) -> None:
        """A missing or invalid bundle never stops the service; outlook is `missing` (AP-08)."""
        try:
            await self.reload()
        except BundleError as error:
            log.warning("no bundle served", reason=str(error), mode=self.mode)
