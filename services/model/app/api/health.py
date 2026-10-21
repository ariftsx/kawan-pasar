"""Probes for Docker and apps/api (docs 13 §A9, §B3). They never require a signature."""

from typing import Literal

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel, ConfigDict

from app.artifacts.store import ArtifactStore, OutlookStatus

router = APIRouter()


class Liveness(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    status: Literal["ok"] = "ok"


class Readiness(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    status: Literal["ok"] = "ok"
    # A missing bundle keeps the service ready so the product still runs (AP-08).
    outlook: OutlookStatus


@router.get("/healthz")
async def liveness(response: Response) -> Liveness:
    response.headers["cache-control"] = "no-store"
    return Liveness()


@router.get("/readyz")
async def readiness(request: Request, response: Response) -> Readiness:
    response.headers["cache-control"] = "no-store"
    store: ArtifactStore = request.app.state.store
    return Readiness(outlook=store.status)
