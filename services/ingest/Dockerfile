# syntax=docker/dockerfile:1
# Build context: services/ingest
FROM ghcr.io/astral-sh/uv:0.13.3 AS uv

FROM python:3.14-slim AS build
COPY --from=uv /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY src ./src
RUN uv sync --frozen --no-dev --no-editable

FROM python:3.14-slim AS runtime
RUN useradd --system --uid 10001 --no-create-home ingest
WORKDIR /app
COPY --from=build --chown=ingest:ingest /app/.venv /app/.venv
ENV PATH="/app/.venv/bin:$PATH" PYTHONUNBUFFERED=1
USER ingest
ENTRYPOINT ["python", "-m", "kp_ingest"]
