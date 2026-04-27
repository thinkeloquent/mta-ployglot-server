#!/usr/bin/env bash
# Per-sibling branch create with refusal logic.
# Run inside one sibling's local_path.
#
# Usage:
#   sibling-branch.sh --name BRANCH [--scope touched|all] [--force] [--json]
#
# Actions:
#   - SCOPE=touched + clean tree → SKIP (no branch created)
#   - branch already exists, no --force → EXISTS, exit 1 (orchestrator can pre-flight)
#   - branch already exists, --force   → WARN, exit 0 (force does NOT delete-and-recreate)
#   - happy path                       → OK, branch created from current HEAD

set -euo pipefail

NAME=""
SCOPE=touched
FORCE=0
JSON=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --name)  NAME="${2:-}"; shift 2 ;;
    --scope) SCOPE="${2:-}"; shift 2 ;;
    --force) FORCE=1; shift ;;
    --json)  JSON=1; shift ;;
    *)       printf 'unknown arg: %s\n' "$1" >&2; exit 64 ;;
  esac
done

[[ -n "$NAME" ]] || { printf 'ERROR: --name required\n' >&2; exit 64; }
: "${SIBLING_NAME:?SIBLING_NAME must be exported by caller}"

emit() {
  local action="$1" detail="$2" sha="${3:-}"
  if [[ "$JSON" -eq 1 ]]; then
    jq -nc \
      --arg name "$SIBLING_NAME" \
      --arg branch "$NAME" \
      --arg action "$action" \
      --arg detail "$detail" \
      --arg sha "$sha" \
      '{name:$name, branch:$branch, action:$action, detail:$detail, sha:$sha}'
  else
    printf '%s | %s%s\n' "$SIBLING_NAME" "$action" "${detail:+: $detail}"
  fi
}

is_touched=false
[[ -n "$(git status --porcelain 2>/dev/null)" ]] && is_touched=true

if [[ "$SCOPE" == "touched" && "$is_touched" == "false" ]]; then
  emit SKIP "not-touched"
  exit 0
fi

if git show-ref --verify --quiet "refs/heads/$NAME"; then
  existing_sha=$(git rev-parse --short "refs/heads/$NAME")
  if [[ "$FORCE" -eq 1 ]]; then
    emit WARN "branch exists at $existing_sha (force does not overwrite)" "$existing_sha"
    exit 0
  else
    emit EXISTS "branch already exists at $existing_sha" "$existing_sha"
    exit 1
  fi
fi

current=$(git symbolic-ref --short HEAD 2>/dev/null || echo "(detached)")
sha=$(git rev-parse --short HEAD)
git branch "$NAME" >/dev/null
emit OK "created from $current@$sha" "$sha"
exit 0
