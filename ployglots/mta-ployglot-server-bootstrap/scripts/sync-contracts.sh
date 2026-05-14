#!/usr/bin/env bash
# Copy JSON Schema contracts between the two runtime packages to keep
# fastify_server/contracts and fastapi_server/contracts in sync.
#
# Usage:
#   scripts/sync-contracts.sh to-fastapi   # copy fastify_server -> fastapi_server
#   scripts/sync-contracts.sh to-fastify   # copy fastapi_server -> fastify_server
#   scripts/sync-contracts.sh diff         # show diff without copying (default)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
A="$ROOT/fastify_server/contracts"
B="$ROOT/fastapi_server/contracts"

case "${1:-diff}" in
  to-fastapi)
    cp -p "$A"/*.schema.json "$B/"
    echo "Copied fastify_server/contracts -> fastapi_server/contracts"
    ;;
  to-fastify)
    cp -p "$B"/*.schema.json "$A/"
    echo "Copied fastapi_server/contracts -> fastify_server/contracts"
    ;;
  diff|*)
    diff -r "$A" "$B" || true
    ;;
esac
