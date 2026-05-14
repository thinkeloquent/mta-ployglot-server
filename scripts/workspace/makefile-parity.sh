#!/usr/bin/env bash
# makefile-parity.sh — pin Makefile behavior across a refactor.
#
# `make -pnq` dumps every variable, rule, and recipe make would resolve, so
# diffing two snapshots proves no behavioral change. The plan's risk model
# treats Makefile refactors as silent-breakage-prone; this script is the gate.
#
# Usage:
#   bash scripts/workspace/makefile-parity.sh snapshot   # capture baseline
#   bash scripts/workspace/makefile-parity.sh diff       # diff baseline vs current
#
# The snapshot file is .makefile-parity-snapshot.txt at the repo root and is
# .gitignore'd (it's a local-only checkpoint).
#
# Filtering:
#   - Make data base header/timing lines (non-deterministic between runs)
#   - The MAKEFILE_LIST variable's value (the entire point of the refactor is
#     to add fragments to MAKEFILE_LIST; counting that as a regression would
#     defeat the point).
#   - Auto-generated `# Variable's value:` comment markers (cosmetic).
set -euo pipefail

SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SELF_DIR/../.." && pwd)"
SNAP="$ROOT_DIR/.makefile-parity-snapshot.txt"

cd "$ROOT_DIR"

normalize() {
  # `make -pnq` exits 1 when any target is out-of-date (PHONY targets are
  # always out-of-date), so wrap in `|| true` to keep `set -e` happy. We
  # only care about the parser dump on stdout.
  local raw
  raw="$(mktemp -t make-parity-raw.XXXXXX)"
  make -pnq >"$raw" 2>/dev/null || true
  grep -vE '^# (Make data base|Started|Finished Make data base|GNU Make)' "$raw" \
    | grep -vE '^MAKEFILE_LIST ' \
    | grep -vE '^MAKEFILE_LIST :=' \
    | grep -vE '^# Variable .*automatic' \
    | grep -vE '^# default$' \
    | grep -vE '^# environment$' \
    | grep -vE '^# makefile' \
    | sort
  rm -f "$raw"
}

case "${1:-}" in
  snapshot)
    normalize > "$SNAP"
    echo "wrote $SNAP ($(wc -l <"$SNAP") lines)"
    ;;
  diff)
    if [[ ! -f "$SNAP" ]]; then
      echo "FAIL: no baseline at $SNAP — run 'snapshot' first" >&2
      exit 66
    fi
    CURRENT="$(mktemp -t make-parity.XXXXXX)"
    trap 'rm -f "$CURRENT"' EXIT
    normalize > "$CURRENT"
    if diff -u "$SNAP" "$CURRENT"; then
      echo "ok: parity preserved"
    else
      echo "FAIL: Makefile parity drift detected (see diff above)" >&2
      exit 1
    fi
    ;;
  *)
    echo "usage: $0 {snapshot|diff}" >&2
    exit 64
    ;;
esac
