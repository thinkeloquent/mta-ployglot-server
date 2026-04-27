#!/usr/bin/env bash
# twin-diff.sh — compare the public surface of fastify vs fastapi and report
# cross-twin drift. Routes use both static and runtime sources; lifecycles
# and env keys are static-only.
#
# Cross-twin drift is the gate (FAIL).
# Within-twin static-vs-runtime disagreement is informational (WARN, never FAIL).
#
# Usage:
#   twin-diff.sh [--warn-only] [--json] [--no-runtime]

set -euo pipefail

WARN_ONLY=0
JSON=0
NO_RUNTIME=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --warn-only)  WARN_ONLY=1; shift ;;
    --json)       JSON=1; shift ;;
    --no-runtime) NO_RUNTIME=1; shift ;;
    *) printf 'unknown arg: %s\n' "$1" >&2; exit 64 ;;
  esac
done

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/twin-surface.sh
source "$HERE/lib/twin-surface.sh"

# ----- Routes: static + runtime -----
fastify_routes_static=$(twin_surface::routes fastify | jq -r '"\(.method) \(.path)"' | sort -u)
fastapi_routes_static=$(twin_surface::routes fastapi | jq -r '"\(.method) \(.path)"' | sort -u)

if [[ "$NO_RUNTIME" -eq 1 ]]; then
  fastify_routes=$fastify_routes_static
  fastapi_routes=$fastapi_routes_static
  routes_via=static
else
  # Try runtime; fall back to static per-twin if runtime emits nothing.
  fastify_runtime=$(twin_surface::routes_runtime fastify 2>/dev/null | jq -r '"\(.method) \(.path)"' | sort -u || true)
  fastapi_runtime=$(twin_surface::routes_runtime fastapi 2>/dev/null | jq -r '"\(.method) \(.path)"' | sort -u || true)

  if [[ -n "$fastify_runtime" ]]; then
    fastify_routes=$fastify_runtime
  else
    echo "WARN: fastify runtime emitter produced no routes — using static fallback" >&2
    fastify_routes=$fastify_routes_static
  fi
  if [[ -n "$fastapi_runtime" ]]; then
    fastapi_routes=$fastapi_runtime
  else
    echo "WARN: fastapi runtime emitter produced no routes — using static fallback" >&2
    fastapi_routes=$fastapi_routes_static
  fi
  routes_via=runtime

  # Within-twin: static vs runtime (informational)
  if [[ -n "$fastify_runtime" ]]; then
    in_static_not_runtime=$(comm -23 <(echo "$fastify_routes_static") <(echo "$fastify_runtime"))
    in_runtime_not_static=$(comm -13 <(echo "$fastify_routes_static") <(echo "$fastify_runtime"))
    [[ -n "$in_static_not_runtime" ]] && echo "$in_static_not_runtime" | while read -r r; do echo "WARN: fastify route in static but not runtime: $r" >&2; done
    [[ -n "$in_runtime_not_static" ]] && echo "$in_runtime_not_static" | while read -r r; do echo "WARN: fastify route in runtime but not static: $r" >&2; done
  fi
fi

# ----- Lifecycles + env keys (static only) -----
fastify_lifecycles=$(twin_surface::lifecycles fastify | jq -r '.name' | sort -u)
fastapi_lifecycles=$(twin_surface::lifecycles fastapi | jq -r '.name' | sort -u)

fastify_env=$(twin_surface::env_keys fastify | jq -r '.key' | sort -u)
fastapi_env=$(twin_surface::env_keys fastapi | jq -r '.key' | sort -u)

# ----- Cross-twin diff -----
DRIFT=0
emit_drift() {
  local surface="$1" missing_in="$2" item="$3" via="$4"
  if [[ "$JSON" -eq 1 ]]; then
    jq -nc --arg surface "$surface" --arg missing_in "$missing_in" --arg item "$item" --arg via "$via" \
      '{surface:$surface, missing_in:$missing_in, item:$item, detected_via:$via}'
  else
    printf 'MISSING IN %s: %s %s\n' "$(echo "$missing_in" | tr '[:lower:]' '[:upper:]')" "$surface" "$item" >&2
  fi
  DRIFT=$((DRIFT + 1))
}

# Routes
while IFS= read -r r; do
  [[ -n "$r" ]] && emit_drift route fastapi "$r" "$routes_via"
done < <(comm -23 <(echo "$fastify_routes") <(echo "$fastapi_routes"))
while IFS= read -r r; do
  [[ -n "$r" ]] && emit_drift route fastify "$r" "$routes_via"
done < <(comm -13 <(echo "$fastify_routes") <(echo "$fastapi_routes"))

# Lifecycles
while IFS= read -r l; do
  [[ -n "$l" ]] && emit_drift lifecycle fastapi "$l" static
done < <(comm -23 <(echo "$fastify_lifecycles") <(echo "$fastapi_lifecycles"))
while IFS= read -r l; do
  [[ -n "$l" ]] && emit_drift lifecycle fastify "$l" static
done < <(comm -13 <(echo "$fastify_lifecycles") <(echo "$fastapi_lifecycles"))

# Env keys
while IFS= read -r k; do
  [[ -n "$k" ]] && emit_drift env fastapi "$k" static
done < <(comm -23 <(echo "$fastify_env") <(echo "$fastapi_env"))
while IFS= read -r k; do
  [[ -n "$k" ]] && emit_drift env fastify "$k" static
done < <(comm -13 <(echo "$fastify_env") <(echo "$fastapi_env"))

# Aggregate summary
fastify_route_count=$(echo "$fastify_routes" | grep -c . || true)
fastapi_route_count=$(echo "$fastapi_routes" | grep -c . || true)
common_routes=$(comm -12 <(echo "$fastify_routes") <(echo "$fastapi_routes") | grep -c . || true)
common_lifecycles=$(comm -12 <(echo "$fastify_lifecycles") <(echo "$fastapi_lifecycles") | grep -c . || true)
common_env=$(comm -12 <(echo "$fastify_env") <(echo "$fastapi_env") | grep -c . || true)

if [[ "$JSON" -eq 0 ]]; then
  echo ""
  printf 'OK: %d matching routes (via %s), %d matching lifecycles, %d matching env keys\n' \
    "$common_routes" "$routes_via" "$common_lifecycles" "$common_env" >&2
  if [[ "$DRIFT" -gt 0 ]]; then
    printf 'twin-diff: %d cross-twin drift item(s)\n' "$DRIFT" >&2
  fi
fi

if [[ "$DRIFT" -eq 0 || "$WARN_ONLY" -eq 1 ]]; then
  exit 0
else
  exit 1
fi
