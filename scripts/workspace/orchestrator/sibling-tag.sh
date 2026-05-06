#!/usr/bin/env bash
# sibling-tag.sh — per-sibling idempotent tag-and-push.
#
# Run inside one sibling's local_path (typically via release-tag-propagate
# which `cd`s into each sibling). Reads the desired SHA from --sha (the
# value pulled from the release manifest). Decision matrix:
#
#   tag absent           → create-and-push
#   tag at expected SHA  → idempotent (exit 0, no remote change)
#   tag at other SHA     → conflict (exit 1) unless --force, then recreate-and-push
#
# Args:
#   --tag TAG       Required.
#   --sha SHA       Required (40-char from manifest).
#   --apply         Without this, dry-run.
#   --force         Override conflict (deletes+pushes new tag).
#   --json          Emit one JSON line per invocation on stdout.

set -euo pipefail

TAG=""
SHA=""
APPLY=0
FORCE=0
JSON=0

: "${SIBLING_NAME:?SIBLING_NAME must be exported by caller}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag)    TAG="${2:-}"; shift 2 ;;
    --sha)    SHA="${2:-}"; shift 2 ;;
    --apply)  APPLY=1; shift ;;
    --force)  FORCE=1; shift ;;
    --json)   JSON=1; shift ;;
    -h|--help)
      echo "usage: SIBLING_NAME=foo sibling-tag.sh --tag v1.2.0 --sha <40-hex> [--apply] [--force] [--json]" >&2
      exit 64 ;;
    *) echo "unknown arg: $1" >&2; exit 64 ;;
  esac
done

[[ -n "$TAG" ]] || { echo "ERROR: --tag required" >&2; exit 64; }
[[ -n "$SHA" ]] || { echo "ERROR: --sha required" >&2; exit 64; }

# Lookup current SHA the tag points to (if any).
existing=$(git rev-parse --verify --quiet "refs/tags/$TAG" 2>/dev/null || echo "NONE")

emit() {
  local action="$1" status="$2" pushed="$3" detail="${4:-}"
  if [[ "$JSON" -eq 1 ]]; then
    jq -nc \
      --arg name "$SIBLING_NAME" \
      --arg tag "$TAG" \
      --arg sha "$SHA" \
      --arg action "$action" \
      --arg status "$status" \
      --argjson pushed "$pushed" \
      --arg detail "$detail" \
      '{name:$name, tag:$tag, sha:$sha, action:$action, status:$status, pushed:$pushed, detail:$detail}'
  else
    printf '%s | %s | %s | %s%s\n' "$SIBLING_NAME" "$TAG" "$SHA" "$action $status" \
      "${detail:+ ($detail)}"
  fi
}

# Decide action.
if [[ "$existing" == "NONE" ]]; then
  decided="create-and-push"
elif [[ "$existing" == "$SHA" ]]; then
  emit "idempotent" "OK" "false" "tag already at expected SHA"
  exit 0
else
  if [[ "$FORCE" -eq 1 ]]; then
    decided="recreate-and-push"
  else
    emit "conflict" "FAIL" "false" "tag exists at $existing, expected $SHA (use --force)"
    exit 1
  fi
fi

# Dry-run.
if [[ "$APPLY" -eq 0 ]]; then
  emit "WOULD-$decided" "DRY-RUN" "false"
  exit 0
fi

# Apply.
case "$decided" in
  create-and-push)
    if ! git tag "$TAG" "$SHA" 2>&1; then
      emit "$decided" "FAIL" "false" "git tag failed"
      exit 2
    fi
    if ! git push origin "$TAG" 2>&1; then
      emit "$decided" "FAIL" "false" "git push failed"
      exit 2
    fi
    emit "$decided" "OK" "true"
    ;;
  recreate-and-push)
    git tag -d "$TAG" >/dev/null 2>&1 || true
    git push origin ":refs/tags/$TAG" >/dev/null 2>&1 || true
    if ! git tag "$TAG" "$SHA"; then
      emit "$decided" "FAIL" "false" "git tag (recreate) failed"
      exit 2
    fi
    if ! git push origin "$TAG"; then
      emit "$decided" "FAIL" "false" "git push (recreate) failed"
      exit 2
    fi
    emit "$decided" "OK" "true"
    ;;
esac
