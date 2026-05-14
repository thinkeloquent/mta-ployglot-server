#!/usr/bin/env bash
# Per-sibling commit. Run inside one sibling's local_path.
#
# Usage:
#   sibling-commit.sh --msg "<message>" [--match-branch BRANCH] [--json]
#
# Refusal: if --match-branch is set and current branch != BRANCH, SKIP.
# Refusal: if no staged changes, SKIP.

set -euo pipefail

MSG=""
MATCH_BRANCH=""
JSON=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --msg)          MSG="${2:-}"; shift 2 ;;
    --match-branch) MATCH_BRANCH="${2:-}"; shift 2 ;;
    --json)         JSON=1; shift ;;
    *)              printf 'unknown arg: %s\n' "$1" >&2; exit 64 ;;
  esac
done

[[ -n "$MSG" ]] || { printf 'ERROR: --msg required\n' >&2; exit 64; }
: "${SIBLING_NAME:?SIBLING_NAME must be exported by caller}"

emit() {
  local action="$1" detail="$2" sha="${3:-}"
  if [[ "$JSON" -eq 1 ]]; then
    jq -nc \
      --arg name "$SIBLING_NAME" \
      --arg action "$action" \
      --arg detail "$detail" \
      --arg sha "$sha" \
      '{name:$name, action:$action, detail:$detail, sha:$sha}'
  else
    printf '%s | %s%s\n' "$SIBLING_NAME" "$action" "${detail:+: $detail}"
  fi
}

current=$(git symbolic-ref --short HEAD 2>/dev/null || echo "(detached)")

if [[ -n "$MATCH_BRANCH" && "$current" != "$MATCH_BRANCH" ]]; then
  emit SKIP "branch-mismatch (current=$current, expected=$MATCH_BRANCH)"
  exit 0
fi

if [[ -z "$(git diff --cached --name-only 2>/dev/null)" ]]; then
  emit SKIP "nothing-staged"
  exit 0
fi

if git commit -q -m "$MSG"; then
  sha=$(git rev-parse --short HEAD)
  emit OK "committed $sha" "$sha"
  exit 0
else
  emit FAIL "commit-failed"
  exit 1
fi
