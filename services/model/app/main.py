"""Model service app (docs 13 Part B): internal network only, no public routes."""

from fastapi import FastAPI

from app.api import health
from app.core.config import Settings
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

    app.include_router(health.router)
    return app


def app() -> FastAPI:
    """Factory for `uvicorn --factory app.main:app`; settings come from the environment."""
    return create_app(Settings())  # pyright: ignore[reportCallIssue] - fields come from env
