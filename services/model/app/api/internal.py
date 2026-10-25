"""/internal routes (docs 08 §7). Mounted behind the HMAC dependency in app.main."""

from datetime import date
from typing import Annotated, Any

from fastapi import APIRouter, Query, Request

from app.artifacts.loader import Bundle, BundleError
from app.artifacts.store import ArtifactStore
from app.errors import ServiceError

router = APIRouter(prefix="/internal")


def _store(request: Request) -> ArtifactStore:
    store: ArtifactStore = request.app.state.store
    return store


def _served(store: ArtifactStore) -> Bundle:
    if store.bundle is None:
        raise ServiceError("FORECAST_UNAVAILABLE", "Belum ada artefak yang disajikan.")
    return store.bundle


@router.get("/artifacts/manifest")
async def manifest(request: Request) -> dict[str, Any]:
    store = _store(request)
    bundle = _served(store)
    return {"data": bundle.manifest.model_dump(mode="json"), "outlook_status": store.status}


@router.get("/forecasts/{commodity}")
async def forecast(
    request: Request, commodity: str, origin: Annotated[date | None, Query()] = None
) -> dict[str, Any]:
    store = _store(request)
    bundle = _served(store)
    found = bundle.forecasts.get(commodity)
    if found is None:
        raise ServiceError("ARTIFACT_NOT_FOUND", "Komoditas tidak ada di artefak ini.")
    if origin is not None and origin != found.run.origin:
        raise ServiceError("FORECAST_UNAVAILABLE", "Perkiraan belum tersedia untuk origin ini.")
    manifest = bundle.manifest
    return {
        "data": found.model_dump(mode="json"),
        "provenance": {
            "model_version": manifest.model_version,
            "dataset_version": manifest.dataset_version,
            "preprocessing_version": manifest.preprocessing_version,
            "data_cutoff": manifest.data_cutoff.isoformat(),
            "artifact_status": manifest.artifact_status,
        },
        "availability": bundle.availability.model_dump(mode="json"),
        "limitations": list(manifest.limitations),
        "outlook_status": store.status,
        "error": None,
    }


@router.post("/artifacts/reload")
async def reload(request: Request) -> dict[str, Any]:
    store = _store(request)
    try:
        bundle = await store.reload()
    except BundleError as error:
        raise ServiceError("SCHEMA_INVALID", f"Bundle ditolak: {error}") from None
    return {"data": {"bundle_id": bundle.manifest.bundle_id}, "outlook_status": store.status}
