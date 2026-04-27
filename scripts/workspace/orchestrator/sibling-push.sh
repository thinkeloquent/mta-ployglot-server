#!/usr/bin/env bash
# Per-sibling push. Run inside one sibling's local_path.
#
# Usage:
#   sibling-push.sh [--apply] [--match-branch BRANCH] [--json]
#
# Default: dry-run (lists what would push, including remote and ref).
# With --apply: pushes; uses --set-upstream when the branch isn't tracked.
# Force-push is intentionally NOT exposed.

set -euo pipefail

APPLY=0
MATCH_BRANCH=""
JSON=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply)        APPLY=1; shift ;;
    --match-branch) MATCH_BRANCH="${2:-}"; shift 2 ;;
    --json)         JSON=1; shift ;;
    *)              printf 'unknown arg: %s\n' "$1" >&2; exit 64 ;;
  esac
done

: "${SIBLING_NAME:?SIBLING_NAME must be exported by caller}"

emit() {
  local action="$1" detail="$2"
  if [[ "$JSON" -eq 1 ]]; then
    jq -nc \
      --arg name "$SIBLING_NAME" \
      --arg action "$action" \
      --arg detail "$detail" \
      '{name:$name, action:$action, detail:$detail}'
  else
    printf '%s | %s%s\n' "$SIBLING_NAME" "$action" "${detail:+: $detail}"
  fi
}

current=$(git symbolic-ref --short HEAD 2>/dev/null || echo "(detached)")

if [[ -n "$MATCH_BRANCH" && "$current" != "$MATCH_BRANCH" ]]; then
  emit SKIP "branch-mismatch (current=$current, expected=$MATCH_BRANCH)"
  exit 0
fi

# Resolve upstream tracking; "NONE" if unset.
upstream=$(git rev-parse --abbrev-ref --symbolic-full-name "@{u}" 2>/dev/null || echo NONE)

if [[ "$upstream" == "NONE" ]]; then
  to_push=$(git rev-list --count HEAD 2>/dev/null || echo 0)
  push_target="origin/$current (new tracking branch)"
else
  to_push=$(git rev-list --count "$upstream..HEAD" 2>/dev/null || echo 0)
  push_target="$upstream"
fi

if [[ "$APPLY" -eq 0 ]]; then
  if [[ "$to_push" -eq 0 && "$upstream" != "NONE" ]]; then
    emit NOOP "0 commits to push to $push_target"
  else
    emit WOULD-PUSH "$to_push commits to $push_target"
  fi
  exit 0
fi

if [[ "$upstream" == "NONE" ]]; then
  if git push --quiet --set-upstream origin "$current" 2>/dev/null; then
    emit OK "pushed $to_push commits to origin/$current (new tracking)"
    exit 0
  else
    emit FAIL "push-failed (new branch)"
    exit 1
  fi
else
  if git push --quiet 2>/dev/null; then
    emit OK "pushed $to_push commits to $upstream"
    exit 0
  else
    emit FAIL "push-failed (non-fast-forward or auth)"
    exit 1
  fi
fi
