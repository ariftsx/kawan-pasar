# syntax=docker/dockerfile:1
# Build context: services/model-arifnet. One-shot job: reads a price file, writes a bundle.
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
RUN useradd --system --uid 10001 --no-create-home model
WORKDIR /app
COPY --from=build --chown=model:model /app/.venv /app/.venv
# The converted ARIF-Net A0 (weights are checked against their sha256 at every start).
COPY --chown=model:model model /app/model
ENV PATH="/app/.venv/bin:$PATH" PYTHONUNBUFFERED=1 KP_MODEL_DIR=/app/model
USER model
ENTRYPOINT ["python", "-m", "kp_model"]
