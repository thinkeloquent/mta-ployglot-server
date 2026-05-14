#!/usr/bin/env bash
# End-to-end smoke test: install, build, boot, curl /healthz on both packages.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOGS="$ROOT/.smoke-logs"
mkdir -p "$LOGS"

FASTIFY_PORT="${FASTIFY_PORT:-55151}"
FASTAPI_PORT="${FASTAPI_PORT:-55252}"

cleanup() {
  for f in "$LOGS/fastify.pid" "$LOGS/fastapi.pid"; do
    [ -f "$f" ] && kill -TERM "$(cat "$f")" 2>/dev/null || true
  done
}
trap cleanup EXIT

echo "==> fastify_server: install + build"
(
  cd "$ROOT/fastify_server"
  [ -d node_modules ] || npm install --silent --no-audit --no-fund
  npx tsc -p .
) > "$LOGS/fastify.install.log" 2>&1

echo "==> fastapi_server: venv + install"
(
  cd "$ROOT"
  [ -d .venv ] || uv venv .venv --python 3.13 > /dev/null
  uv pip install --python .venv/bin/python --quiet -e "./fastapi_server[dev]"
) > "$LOGS/fastapi.install.log" 2>&1

echo "==> boot fastify on :$FASTIFY_PORT"
(
  cd "$ROOT/fastify_server"
  PORT=$FASTIFY_PORT node examples/quickstart/main.mjs > "$LOGS/fastify.log" 2>&1 &
  echo $! > "$LOGS/fastify.pid"
)

echo "==> boot fastapi on :$FASTAPI_PORT"
(
  cd "$ROOT"
  PORT=$FASTAPI_PORT .venv/bin/python fastapi_server/examples/quickstart/main.py > "$LOGS/fastapi.log" 2>&1 &
  echo $! > "$LOGS/fastapi.pid"
)

sleep 3

echo "==> curl fastify /healthz"
curl -fsS "http://127.0.0.1:$FASTIFY_PORT/healthz" | tee "$LOGS/fastify.healthz.json"
echo ""

echo "==> curl fastapi /healthz"
curl -fsS "http://127.0.0.1:$FASTAPI_PORT/healthz" | tee "$LOGS/fastapi.healthz.json"
echo ""

echo "==> diff loader report summaries"
curl -fsS "http://127.0.0.1:$FASTIFY_PORT/_reports" \
  | python3 -c 'import json,sys;d=json.load(sys.stdin);print(json.dumps({k:{"registered":v["registered"],"errors":len(v["errors"])} for k,v in d.items()},sort_keys=True,indent=2))' \
  > "$LOGS/fastify.reports-summary.json"

curl -fsS "http://127.0.0.1:$FASTAPI_PORT/_reports" \
  | python3 -c 'import json,sys;d=json.load(sys.stdin);print(json.dumps({k:{"registered":v["registered"],"errors":len(v["errors"])} for k,v in d.items()},sort_keys=True,indent=2))' \
  > "$LOGS/fastapi.reports-summary.json"

if diff "$LOGS/fastify.reports-summary.json" "$LOGS/fastapi.reports-summary.json"; then
  echo "==> SMOKE OK (loader reports match)"
else
  echo "==> SMOKE FAIL (loader report mismatch)"
  exit 1
fi
