# syntax=docker/dockerfile:1
# Build context: services/ (pipeline + model-arifnet). ARIF-Net A0 retraining pipeline (Fase 4A).
# Python 3.12 (ARIF-Net v1.1.0's tested environment), CPU-only PyTorch, no Docker socket.
FROM ghcr.io/astral-sh/uv:0.13.3 AS uv

FROM python:3.12-slim AS build
COPY --from=uv /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never
WORKDIR /app
COPY pipeline/pyproject.toml pipeline/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY pipeline/src ./src
RUN uv sync --frozen --no-dev --no-editable

FROM python:3.12-slim AS runtime
RUN useradd --system --uid 10002 --create-home pipeline
WORKDIR /app
COPY --from=build --chown=root:root /app/.venv /app/.venv
# The copied ARIF-Net code (checked against MANIFEST.sha256 before every run) and the config.
COPY --chown=root:root pipeline/vendor /app/vendor
COPY --chown=root:root pipeline/config /app/config
# kp_model (numpy only, same code as the model service: its tests pass on 3.12) makes the bundle.
COPY --chown=root:root model-arifnet/src /app/model-src
COPY --chown=root:root model-arifnet/model/calendar_holidays.json /app/product-calendar.json
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    KP_PIPELINE_HOME=/app \
    KP_PRODUCT_CALENDAR=/app/product-calendar.json \
    KP_MODEL_CMD="env PYTHONPATH=/app/model-src python -m kp_model"
# Evidence store and runs live on a volume; the code is read-only (owned by root).
VOLUME ["/data"]
USER pipeline
ENTRYPOINT ["kp-pipeline"]
