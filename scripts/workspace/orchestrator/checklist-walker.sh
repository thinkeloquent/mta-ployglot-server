#!/usr/bin/env bash
# checklist-walker.sh — interactive walk through every Checklist gate, prompting
# [Y/n] between gates and showing which Checklist.md step each gate corresponds to.
#
# Falls back to `make pre-push` when stdin is not a TTY or CI=1 is set.

set -euo pipefail

if ! [[ -t 0 ]] || [[ -n "${CI:-}" ]]; then
  exec make -s pre-push
fi

# Pairs of (gate, "Checklist step | description")
# Order matches Makefile.gates PRE_PUSH_GATES.
GATES=(
  "addon-lint|Step 3 — Implementation: Bootstrap-addon prefix discipline"
  "vault-check|Step 2 — Environment Setup: Verify env keys reachable"
  "twin-diff|Step 4 — Local Testing: Twin parity check (static + runtime routes)"
  "projections-check|Step 4 — Local Testing: Workspace projections in sync"
  "subtree-lint|Step 4 — Local Testing: Subtree --squash discipline"
  "security-scan|Step 4 — Local Testing: Security scans"
  "changelog-check|Step 5 — Commit & Push: Changelog entry exists"
  "agent-md-check|Step 5 — Commit & Push: .agent.md surface-hash matches"
)

if [[ -t 1 ]]; then
  C_BOLD=$'\033[1m'; C_DIM=$'\033[2m'; C_GRN=$'\033[32m'; C_RED=$'\033[31m'; C_OFF=$'\033[0m'
else
  C_BOLD=""; C_DIM=""; C_GRN=""; C_RED=""; C_OFF=""
fi

PASS=0; FAIL=0; SKIP=0

prompt() {
  # $1 = prompt; default Y
  local p="$1" ans
  read -r -p "$p [Y/n] " ans </dev/tty || ans=""
  case "$ans" in
    n|N|no|NO) return 1 ;;
    *) return 0 ;;
  esac
}

for entry in "${GATES[@]}"; do
  gate="${entry%%|*}"
  label="${entry#*|}"
  echo ""
  printf '%b═══ %s ═══%b\n' "$C_BOLD" "$label" "$C_OFF"
  printf '%b    gate: make %s%b\n' "$C_DIM" "$gate" "$C_OFF"

  if prompt "Run this gate?"; then
    set +e
    make -s "$gate"
    rc=$?
    set -e
    if [[ "$rc" -eq 0 ]]; then
      printf '%b    ✓ PASS%b\n' "$C_GRN" "$C_OFF"
      PASS=$((PASS + 1))
    else
      printf '%b    ✗ FAIL (exit %d)%b\n' "$C_RED" "$rc" "$C_OFF"
      FAIL=$((FAIL + 1))
      if ! prompt "Continue to next gate?"; then
        echo "Aborted at $gate."
        break
      fi
    fi
  else
    printf '%b    SKIPPED%b\n' "$C_DIM" "$C_OFF"
    SKIP=$((SKIP + 1))
  fi
done

echo ""
printf '%bSummary:%b PASS=%d  FAIL=%d  SKIP=%d  /  %d gates total\n' \
  "$C_BOLD" "$C_OFF" "$PASS" "$FAIL" "$SKIP" "${#GATES[@]}"

if [[ "$FAIL" -gt 0 ]]; then exit 1; fi
exit 0
