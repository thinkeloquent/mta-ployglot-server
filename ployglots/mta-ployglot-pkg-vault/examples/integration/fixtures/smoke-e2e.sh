#!/usr/bin/env bash
set -euo pipefail

BOOTSTRAP="${BOOTSTRAP_REPO:-/Users/Shared/autoload/mta-ployglot-server-bootstrap}"
RUNTIME="${RUNTIME_REPO:-/Users/Shared/autoload/mta-ployglot-server}"

skip_if_missing() {
  local label="$1" path="$2"
  if [ ! -d "$path" ]; then
    echo "[skipped] $label not found at $path"
    exit 0
  fi
}

skip_if_missing "server-bootstrap" "$BOOTSTRAP"
skip_if_missing "server-runtime" "$RUNTIME"

# Boot fastify with the local package linked in.
(cd "$BOOTSTRAP/fastify_server" && npm link @polyglot/vault-file 2>/dev/null || true)
(cd "$BOOTSTRAP/fastapi_server" && uv pip install -e ../../packages/py 2>/dev/null || true)

(cd "$RUNTIME" && make docker)
curl --fail -sS http://localhost:5100/healthz
curl --fail -sS http://localhost:5200/healthz
(cd "$RUNTIME" && make down)
