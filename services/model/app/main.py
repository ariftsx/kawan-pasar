"""Model service app (docs 13 Part B): internal network only, no public routes."""

from fastapi import APIRouter, Depends, FastAPI

from app.api import health
from app.core.config import Settings
from app.core.security import signature_verifier
from app.errors import register_error_handlers
from app.observability import configure_logging, request_context


def create_app(settings: Settings) -> FastAPI:
    configure_logging(settings.log_level)
    # No OpenAPI or docs UI: nothing here is meant to be browsed.
    app = FastAPI(
        title="Kawan Pasar model service", openapi_url=None, docs_url=None, redoc_url=None
    )
    app.middleware("http")(request_context)
    register_error_handlers(app)

    verify = signature_verifier(
        settings.model_hmac_secret.get_secret_value().encode(), settings.hmac_max_skew_seconds
    )
    # Every /internal route sits behind the HMAC check (docs 08 §7); routes land in later PRs.
    internal = APIRouter(prefix="/internal", dependencies=[Depends(verify)])

    app.include_router(health.router)
    app.include_router(internal)
    return app


def app() -> FastAPI:
    """Factory for `uvicorn --factory app.main:app`; settings come from the environment."""
    return create_app(Settings())  # pyright: ignore[reportCallIssue] - fields come from env
