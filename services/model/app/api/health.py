"""Probes for Docker and apps/api (docs 13 §A9, §B3). They never require a signature."""

from typing import Literal

from fastapi import APIRouter, Response
from pydantic import BaseModel, ConfigDict

router = APIRouter()


class Liveness(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    status: Literal["ok"] = "ok"


class Readiness(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    status: Literal["ok"] = "ok"
    # The bundle loader (next PR) reports `available`, `in_development`, or `missing` here;
    # a missing bundle keeps the service ready so the product still runs (AP-08).
    outlook: Literal["available", "in_development", "missing"]


@router.get("/healthz")
async def liveness(response: Response) -> Liveness:
    response.headers["cache-control"] = "no-store"
    return Liveness()


@router.get("/readyz")
async def readiness(response: Response) -> Readiness:
    response.headers["cache-control"] = "no-store"
    return Readiness(outlook="missing")
