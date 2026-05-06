#!/usr/bin/env bash
# subtree-size-check.sh — defense-in-depth against missing --squash.
#
# `subtree-lint.sh` is the static guard; this is the dynamic guard. After an
# assembly, the .git/ size delta must stay under $SUBTREE_SIZE_CAP_MB. Either
# guard failing is sufficient to fail the CI run.
#
# Subcommands:
#   snapshot   record current .git/ size to .git/.subtree-size-before
#   check      compare current size against the snapshot; fail if delta > cap
#
# Env:
#   SUBTREE_SIZE_CAP_MB   delta cap in MB (default 50)
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
CAP_MB="${SUBTREE_SIZE_CAP_MB:-50}"
BEFORE_FILE="$ROOT_DIR/.git/.subtree-size-before"

current_mb() {
  du -sm "$ROOT_DIR/.git" 2>/dev/null | awk '{print $1}'
}

case "${1:-check}" in
  snapshot)
    mb="$(current_mb)"
    echo "$mb" > "$BEFORE_FILE"
    echo "snapshot: ${mb} MB"
    ;;
  check)
    if [[ ! -f "$BEFORE_FILE" ]]; then
      echo "FAIL: no snapshot at $BEFORE_FILE — call '$(basename "$0") snapshot' first" >&2
      exit 1
    fi
    before="$(cat "$BEFORE_FILE")"
    after="$(current_mb)"
    delta=$((after - before))
    echo ".git size: ${before}MB → ${after}MB (delta ${delta}MB, cap ${CAP_MB}MB)"
    if [[ "$delta" -gt "$CAP_MB" ]]; then
      echo "FAIL: .git grew by ${delta}MB (cap ${CAP_MB}MB) — likely a missing --squash" >&2
      exit 1
    fi
    rm -f "$BEFORE_FILE"
    ;;
  *)
    echo "usage: $(basename "$0") {snapshot|check}" >&2
    exit 64
    ;;
esac
