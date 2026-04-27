#!/usr/bin/env bash
# sibling-gate.sh — per-sibling Checklist gate runner.
#
# Detects what gate machinery the sibling exposes and dispatches to the
# strongest available capability:
#   1. `make pre-push`       (full Checklist gate set; only this orchestrator
#                             repo has it today)
#   2. `make ci`             (generic CI pipeline)
#   3. `make test` + `make lint` (minimal substitute)
#   4. none                  (skip — emits status=skip, exits 0; see Notes)
#
# Run inside one sibling's local_path (typically via _for-each-sibling.sh).
# The sibling-name comes from $SIBLING_NAME exported by the caller; the
# orchestration root sibling (the repo this script lives in) always uses
# `pre-push` regardless of detection — see ORCH_ROOT_NAME below.
#
# Notes:
#   - "no Makefile" → status=skip (NOT fail) so a sibling without CI surface
#     doesn't block release-preflight. Operators audit skips separately.
#   - Exit 0 on pass OR skip; exit non-zero on fail.
#
# Usage:
#   SIBLING_NAME=foo ./sibling-gate.sh [--json]

set -euo pipefail

JSON=0
[[ "${1:-}" == "--json" ]] && JSON=1

: "${SIBLING_NAME:?SIBLING_NAME must be exported by caller}"
: "${ORCH_ROOT_NAME:=mta-ployglot-server}"

# Returns 0 if `make` recognizes the named target.
__has_target() {
  local tgt="$1"
  [[ -f Makefile ]] || return 1
  make -n "$tgt" >/dev/null 2>&1
}

caps=()
chosen=""

if [[ "$SIBLING_NAME" == "$ORCH_ROOT_NAME" ]]; then
  caps+=("pre-push")
  chosen="pre-push"
elif __has_target pre-push; then
  caps+=("pre-push")
  chosen="pre-push"
elif __has_target ci; then
  caps+=("ci")
  chosen="ci"
elif __has_target test && __has_target lint; then
  caps+=("test+lint")
  chosen="test+lint"
else
  caps+=("none")
  chosen="none"
fi

emit() {
  local status="$1" gate="$2"
  local caps_csv
  caps_csv=$(IFS=,; echo "${caps[*]}")
  if [[ "$JSON" -eq 1 ]]; then
    jq -nc \
      --arg name "$SIBLING_NAME" \
      --arg gate "$gate" \
      --arg status "$status" \
      --arg caps "$caps_csv" \
      '{name:$name, gate:$gate, status:$status, caps:($caps|split(","))}'
  else
    printf '%s | gate: %s | %s\n' "$SIBLING_NAME" "$gate" "$status"
  fi
}

# Run the chosen gate, capturing exit status.
rc=0
case "$chosen" in
  pre-push)
    make -s pre-push >/dev/null 2>&1 || rc=$?
    ;;
  ci)
    make -s ci >/dev/null 2>&1 || rc=$?
    ;;
  test+lint)
    if ! make -s lint >/dev/null 2>&1; then rc=1; fi
    if ! make -s test >/dev/null 2>&1; then rc=1; fi
    ;;
  none)
    emit "SKIP" "$chosen"
    exit 0
    ;;
esac

if [[ "$rc" -eq 0 ]]; then
  emit "PASS" "$chosen"
  exit 0
else
  emit "FAIL" "$chosen"
  exit "$rc"
fi
