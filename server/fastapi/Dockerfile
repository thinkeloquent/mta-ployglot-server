# syntax=docker/dockerfile:1.7
# server/fastapi/Dockerfile
#
# Multi-stage build for the standalone mta-fastapi-server.
# Installs thinkeloquent-fastapi-server (from the bootstrap submodule) into an
# isolated venv, then runs server/fastapi/main.py which extends it.
#
# Build context is the repo root so `COPY ployglots/...` and `COPY server/...`
# both resolve.
#
# Hardening (limited, not production):
#   - base image pinned by digest
#   - non-root runtime user (`app`, uid 10001 — created here since python:slim
#     has no conventional non-root user)
#   - PYTHONHASHSEED=random

ARG PYTHON_IMAGE=python:3.13-slim@sha256:bada92bcc2794014c291cd97ac3604eb907746b9d3f4b4ff5a8a1ffeff40ceff

# -----------------------------------------------------------------------------
# Stage 1: builder — install bootstrap package into an isolated venv
# -----------------------------------------------------------------------------
FROM ${PYTHON_IMAGE} AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    UV_PYTHON_PREFERENCE=only-system

WORKDIR /build

# Install uv (Astral's fast Python package manager).
RUN pip install --no-cache-dir "uv==0.11.11"

# Copy ONLY the fastapi_server package tree from the submodule.
COPY ployglots/mta-ployglot-server-bootstrap/fastapi_server/ /build/fastapi_server/

# Create an isolated venv and install the bootstrap package into it.
# No [dev] extra — pytest/httpx/twine/build don't belong in a runtime image.
RUN uv venv /opt/venv --python 3.13 \
 && uv pip install --python /opt/venv/bin/python /build/fastapi_server

# Smoke-check the install.
RUN /opt/venv/bin/python -c "import fastapi_server; print('installed:', fastapi_server.__name__)"

# -----------------------------------------------------------------------------
# Stage 2: runtime — minimal, non-root
# -----------------------------------------------------------------------------
FROM ${PYTHON_IMAGE} AS runtime

# Create a dedicated non-root user (python:slim doesn't ship one).
RUN groupadd --system --gid 10001 app \
 && useradd  --system --uid 10001 --gid app --home-dir /app --shell /sbin/nologin app \
 && mkdir -p /app \
 && chown app:app /app

ENV PATH="/opt/venv/bin:${PATH}" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONHASHSEED=random \
    PORT=8080 \
    POLYGLOT_DEBUG=1

WORKDIR /app

# Copy the built venv + standalone app tree, owned by app:app.
COPY --from=builder --chown=app:app /opt/venv /opt/venv
COPY --chown=app:app server/fastapi/main.py ./main.py
COPY --chown=app:app server/fastapi/config  ./config

USER app

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD python -c "import os,urllib.request,sys; \
port=os.environ.get('PORT','8080'); \
r=urllib.request.urlopen(f'http://127.0.0.1:{port}/healthz', timeout=2); \
sys.exit(0 if r.status == 200 else 1)"

# The standalone main.py boots uvicorn internally and respects $PORT.
CMD ["python", "main.py"]
