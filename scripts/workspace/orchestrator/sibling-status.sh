#!/usr/bin/env bash
# Per-sibling git state probe. Run inside one sibling's local_path
# (typically via _for-each-sibling.sh).
#
# Usage:
#   sibling-status.sh [--json]

set -euo pipefail

JSON=0
[[ "${1:-}" == "--json" ]] && JSON=1

: "${SIBLING_NAME:?SIBLING_NAME must be exported by caller}"
: "${SIBLING_DEFAULT_REF:=main}"

# Current branch; "(detached)" if HEAD is detached.
branch=$(git symbolic-ref --short HEAD 2>/dev/null || echo "(detached)")

# Best-effort fetch — failure is OK; ahead/behind just shows 0/0.
git fetch --quiet origin "$SIBLING_DEFAULT_REF" 2>/dev/null || true

ahead=$(git rev-list --count "origin/$SIBLING_DEFAULT_REF..HEAD" 2>/dev/null || echo 0)
behind=$(git rev-list --count "HEAD..origin/$SIBLING_DEFAULT_REF" 2>/dev/null || echo 0)

if [[ -n "$(git status --porcelain 2>/dev/null)" ]]; then
  dirty=true
else
  dirty=false
fi

if [[ "$branch" == "$SIBLING_DEFAULT_REF" ]]; then
  on_default=true
else
  on_default=false
fi

last_commit_age=$(git log -1 --format=%cr HEAD 2>/dev/null || echo "no commits")

if [[ "$JSON" -eq 1 ]]; then
  jq -nc \
    --arg name "$SIBLING_NAME" \
    --arg branch "$branch" \
    --argjson ahead "$ahead" \
    --argjson behind "$behind" \
    --argjson dirty "$dirty" \
    --argjson on_default_ref "$on_default" \
    --arg last_commit_age "$last_commit_age" \
    '{name:$name, branch:$branch, ahead:$ahead, behind:$behind, dirty:$dirty, on_default_ref:$on_default_ref, last_commit_age:$last_commit_age}'
else
  if [[ "$dirty" == "true" ]]; then
    dirty_label=DIRTY
  else
    dirty_label=clean
  fi
  printf '%s | %s | +%s/-%s | %s | %s\n' \
    "$SIBLING_NAME" "$branch" "$ahead" "$behind" "$dirty_label" "$last_commit_age"
fi

# Exit 0 only if clean and on default ref; otherwise exit 1 so caller can aggregate.
if [[ "$dirty" == "false" && "$on_default" == "true" ]]; then
  exit 0
else
  exit 1
fi
