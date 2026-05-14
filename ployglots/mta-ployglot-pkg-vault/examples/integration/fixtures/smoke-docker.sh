#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_REPO="${SERVER_REPO:-/Users/Shared/autoload/mta-ployglot-server}"

if [ ! -d "$SERVER_REPO" ]; then
  echo "[skipped] server-runtime repo not found at $SERVER_REPO"
  exit 0
fi

cd "$SERVER_REPO"
docker compose \
  -f docker-compose.yml \
  -f "$HERE/compose.vault-file.yml" \
  up --build --wait

curl --fail -sS http://localhost:5100/healthz
curl --fail -sS http://localhost:5200/healthz

docker compose \
  -f docker-compose.yml \
  -f "$HERE/compose.vault-file.yml" \
  down
