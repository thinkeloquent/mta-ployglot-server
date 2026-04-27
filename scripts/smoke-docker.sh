#!/usr/bin/env bash
# scripts/smoke-docker.sh — end-to-end compose smoke test.
# Boots fastify + fastapi via docker compose, waits for healthy, curls /healthz.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Source .env if present so FASTIFY_PORT / FASTAPI_PORT overrides apply.
if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

FASTIFY_PORT="${FASTIFY_PORT:-5100}"
FASTAPI_PORT="${FASTAPI_PORT:-5200}"
TIMEOUT="${SMOKE_TIMEOUT:-60}"

cleanup() {
  echo "==> teardown"
  docker compose down --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "==> docker compose up -d --build"
docker compose up -d --build

echo "==> waiting up to ${TIMEOUT}s for both services to report healthy"
deadline=$(( $(date +%s) + TIMEOUT ))
while :; do
  fastify_health=$(docker inspect --format '{{.State.Health.Status}}' mta-fastify 2>/dev/null || echo missing)
  fastapi_health=$(docker inspect --format '{{.State.Health.Status}}' mta-fastapi 2>/dev/null || echo missing)
  printf '    fastify=%-10s fastapi=%-10s\n' "$fastify_health" "$fastapi_health"
  if [ "$fastify_health" = "healthy" ] && [ "$fastapi_health" = "healthy" ]; then
    break
  fi
  if [ "$(date +%s)" -ge "$deadline" ]; then
    echo "==> TIMEOUT — dumping logs"
    docker compose logs --no-color --tail=200 fastify fastapi || true
    exit 1
  fi
  sleep 2
done

echo "==> curl fastify /healthz (port $FASTIFY_PORT)"
curl -fsS "http://127.0.0.1:${FASTIFY_PORT}/healthz" | tee /tmp/smoke-fastify.json
echo
python3 -c 'import json,sys; json.loads(open("/tmp/smoke-fastify.json").read())'

echo "==> curl fastapi /healthz (port $FASTAPI_PORT)"
curl -fsS "http://127.0.0.1:${FASTAPI_PORT}/healthz" | tee /tmp/smoke-fastapi.json
echo
python3 -c 'import json,sys; json.loads(open("/tmp/smoke-fastapi.json").read())'

echo "==> _reports summary diff (parity across runtimes)"
for svc in fastify fastapi; do
  port_var="$(echo $svc | tr a-z A-Z)_PORT"
  port="${!port_var}"
  curl -fsS "http://127.0.0.1:${port}/_reports" 2>/dev/null \
    | python3 -c 'import json,sys
try:
    d=json.load(sys.stdin)
    summary={k:{"registered":v.get("registered"),"errors":len(v.get("errors",[]))} for k,v in d.items()}
    print(json.dumps(summary, sort_keys=True))
except Exception as e:
    print("(no _reports surface or parse error:", e, ")", file=sys.stderr)
    sys.exit(0)' > "/tmp/smoke-${svc}-reports.json" || true
done
if [ -s /tmp/smoke-fastify-reports.json ] && [ -s /tmp/smoke-fastapi-reports.json ]; then
  echo "  fastify: $(cat /tmp/smoke-fastify-reports.json)"
  echo "  fastapi: $(cat /tmp/smoke-fastapi-reports.json)"
  if diff /tmp/smoke-fastify-reports.json /tmp/smoke-fastapi-reports.json >/dev/null; then
    echo "  => reports MATCH"
  else
    echo "  => reports DIFFER (non-fatal)"
  fi
fi

echo "==> SMOKE OK"
