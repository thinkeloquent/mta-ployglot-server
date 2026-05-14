#!/usr/bin/env bash
# changelog-check.sh — confirm at least one new file under .changelogs/<repo>/
# exists since the merge-base with main.
#
# Aligns with the /ployglot-changelog skill's per-commit emission convention.
# If the .changelogs/ submodule isn't present, emit WARN and exit 0 (don't fail).
#
# Usage:
#   changelog-check.sh [--json] [--base BRANCH]

set -euo pipefail

JSON=0
BASE=main

while [[ $# -gt 0 ]]; do
  case "$1" in
    --json) JSON=1; shift ;;
    --base) BASE="${2:-main}"; shift 2 ;;
    *) printf 'unknown arg: %s\n' "$1" >&2; exit 64 ;;
  esac
done

REPO_NAME="${REPO_NAME:-$(basename "$(pwd)")}"

emit() {
  local status="$1" detail="$2" entries="$3" base="$4"
  if [[ "$JSON" -eq 1 ]]; then
    jq -nc --arg status "$status" --arg repo "$REPO_NAME" \
      --arg detail "$detail" --arg base "$base" \
      --argjson entries "$entries" \
      '{status:$status, repo:$repo, detail:$detail, entries:$entries, merge_base:$base}'
  else
    echo "$detail"
  fi
}

if [[ ! -d ".changelogs" ]]; then
  emit warn "WARN: .changelogs/ submodule not present; run /ployglot-changelog-setup" "[]" ""
  exit 0
fi

if ! git rev-parse "$BASE" >/dev/null 2>&1; then
  emit warn "WARN: base branch '$BASE' not found; nothing to compare against" "[]" ""
  exit 0
fi

dir=".changelogs/$REPO_NAME"
merge_base=$(git merge-base HEAD "$BASE" 2>/dev/null || echo "")

if [[ -z "$merge_base" ]]; then
  emit warn "WARN: no merge-base with $BASE" "[]" ""
  exit 0
fi

# New files added under .changelogs/<repo>/ since merge-base
new_entries=$(git diff --diff-filter=A --name-only "$merge_base"..HEAD -- "$dir/" 2>/dev/null || true)

if [[ -z "$new_entries" ]]; then
  detail="MISSING: no $dir/ entry since $merge_base. Run /ployglot-changelog to add one."
  if [[ "$JSON" -eq 1 ]]; then
    emit missing "$detail" "[]" "$merge_base"
  else
    echo "$detail" >&2
  fi
  exit 1
fi

count=$(echo "$new_entries" | wc -l | tr -d ' ')
entries_json=$(echo "$new_entries" | jq -R . | jq -s .)

if [[ "$JSON" -eq 1 ]]; then
  emit ok "OK: $count new entry(ies)" "$entries_json" "$merge_base"
else
  echo "OK: $count new entry(ies) since $merge_base"
  echo "$new_entries" | sed 's/^/  /'
fi
