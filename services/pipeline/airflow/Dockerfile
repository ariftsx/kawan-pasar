# syntax=docker/dockerfile:1
# Build context: services/ (pipeline, ingest, model-arifnet). Apache Airflow for the Kawan Pasar
# pipeline (Fase 4B, ADR 0016). The DAGs call CLIs in their own venvs; Airflow's own Python never
# imports PyTorch or the pipeline. No Docker socket.
FROM ghcr.io/astral-sh/uv:0.13.3 AS uv

FROM apache/airflow:3.3.2-python3.12
USER root
COPY --from=uv /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_INSTALL_DIR=/opt/uv-python

# Retraining pipeline: Python 3.12 (ARIF-Net's tested version), exact versions from uv.lock.
WORKDIR /opt/pipeline
COPY pipeline/pyproject.toml pipeline/uv.lock ./
RUN UV_PROJECT_ENVIRONMENT=/opt/pipeline/.venv uv sync --frozen --no-dev --no-install-project \
      --python /usr/python/bin/python3.12 --no-python-downloads
COPY pipeline/src ./src
RUN UV_PROJECT_ENVIRONMENT=/opt/pipeline/.venv uv sync --frozen --no-dev --no-editable \
      --python /usr/python/bin/python3.12 --no-python-downloads
COPY pipeline/vendor ./vendor
COPY pipeline/config ./config
COPY model-arifnet/src /opt/model-src
COPY model-arifnet/model/calendar_holidays.json /opt/product-calendar.json

# Price import: kp_ingest on Python 3.14 (its own requirement), installed by uv.
WORKDIR /opt/ingest
COPY ingest/pyproject.toml ingest/uv.lock ./
RUN uv python install 3.14 \
 && UV_PROJECT_ENVIRONMENT=/opt/ingest/.venv uv sync --frozen --no-dev --no-install-project --python 3.14
COPY ingest/src ./src
RUN UV_PROJECT_ENVIRONMENT=/opt/ingest/.venv uv sync --frozen --no-dev --no-editable --python 3.14

COPY pipeline/airflow/dags /opt/airflow/dags
COPY pipeline/airflow/check_dags.py /opt/airflow/check_dags.py
# Code owned by root, read-only for the airflow user; it writes only to /data and its own home.
# The airflow user is in group root (gid 0): group write is removed too.
RUN CODE="/opt/pipeline /opt/ingest /opt/uv-python /opt/model-src /opt/airflow/dags /opt/airflow/check_dags.py" \
 && chown -R root:root $CODE && chmod -R a+rX,go-w $CODE

ENV KP_PIPELINE_HOME=/opt/pipeline \
    KP_PRODUCT_CALENDAR=/opt/product-calendar.json \
    KP_MODEL_CMD="env PYTHONPATH=/opt/model-src /opt/pipeline/.venv/bin/python -m kp_model" \
    KP_PIPELINE_BIN=/opt/pipeline/.venv/bin/kp-pipeline \
    KP_INGEST_PYTHON=/opt/ingest/.venv/bin/python \
    KP_STORE=/data/store \
    KP_RUNS=/data/runs \
    # The DAGs import their shared helper (kawan_pasar_common) in every Airflow process.
    PYTHONPATH=/opt/airflow/dags
WORKDIR /opt/airflow
USER airflow
