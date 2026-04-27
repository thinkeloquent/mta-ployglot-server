#!/usr/bin/env bash
# Per-sibling fetch + dirty-check + fast-forward probe; pulls when --apply.
# Run inside one sibling's local_path.
#
# Usage:
#   sibling-sync.sh [--apply] [--ref REF] [--json]
#
# Refusal modes (all exit 0; "skip" is intentional, not failure):
#   - dirty tree
#   - on a non-default branch
#   - non-fast-forward (local diverged from origin)

set -euo pipefail

APPLY=0
REF=""
JSON=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply) APPLY=1; shift ;;
    --ref)   REF="${2:-}"; shift 2 ;;
    --json)  JSON=1; shift ;;
    *)       printf 'unknown arg: %s\n' "$1" >&2; exit 64 ;;
  esac
done

: "${SIBLING_NAME:?SIBLING_NAME must be exported by caller}"
: "${SIBLING_DEFAULT_REF:=main}"
[[ -n "$REF" ]] || REF="$SIBLING_DEFAULT_REF"

emit() {
  local action="$1" reason="$2" commits="$3"
  if [[ "$JSON" -eq 1 ]]; then
    jq -nc \
      --arg name "$SIBLING_NAME" \
      --arg action "$action" \
      --arg reason "$reason" \
      --arg ref "$REF" \
      --argjson commits "$commits" \
      '{name:$name, action:$action, reason:$reason, ref:$ref, commits:$commits}'
  else
    case "$action" in
      would-pull|pulled|noop)
        action_upper=$(printf '%s' "$action" | tr '[:lower:]' '[:upper:]')
        printf '%s | %s: %s commits from %s\n' "$SIBLING_NAME" "$action_upper" "$commits" "$REF" ;;
      skip)
        printf '%s | SKIP: %s\n' "$SIBLING_NAME" "$reason" ;;
      fail)
        printf '%s | FAIL: %s\n' "$SIBLING_NAME" "$reason" ;;
    esac
  fi
}

# Best-effort fetch — failure means we can't compute commits-to-pull.
if ! git fetch --quiet origin "$REF" 2>/dev/null; then
  emit fail "fetch-failed" 0
  exit 1
fi

current=$(git symbolic-ref --short HEAD 2>/dev/null || echo "(detached)")

if [[ "$current" != "$REF" ]]; then
  emit skip "on-non-default-branch (current=$current)" 0
  exit 0
fi

if [[ -n "$(git status --porcelain 2>/dev/null)" ]]; then
  emit skip "dirty-tree" 0
  exit 0
fi

if ! git merge-base --is-ancestor HEAD "origin/$REF" 2>/dev/null; then
  emit skip "not-fast-forward" 0
  exit 0
fi

commits=$(git rev-list --count "HEAD..origin/$REF" 2>/dev/null || echo 0)

if [[ "$APPLY" -eq 1 ]]; then
  if git pull --ff-only --quiet origin "$REF"; then
    emit pulled "" "$commits"
    exit 0
  else
    emit fail "pull-failed" 0
    exit 1
  fi
else
  if [[ "$commits" -eq 0 ]]; then
    emit noop "" 0
  else
    emit would-pull "" "$commits"
  fi
  exit 0
fi
