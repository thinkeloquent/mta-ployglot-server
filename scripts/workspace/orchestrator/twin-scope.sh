#!/usr/bin/env bash
# twin-scope.sh — classify each path as fastify-only, fastapi-only, both,
# parity-contract, or unrelated.
#
# Usage:
#   twin-scope.sh [--json] PATH [PATH ...]

set -euo pipefail

JSON=0
PATHS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --json) JSON=1; shift ;;
    --)     shift; PATHS+=("$@"); break ;;
    -*)     printf 'unknown arg: %s\n' "$1" >&2; exit 64 ;;
    *)      PATHS+=("$1"); shift ;;
  esac
done

[[ "${#PATHS[@]}" -gt 0 ]] || {
  printf 'usage: twin-scope.sh [--json] PATH [PATH ...]\n' >&2
  exit 64
}

# Compute the mirrored path on the other twin.
mirror_path() {
  local p="$1"
  case "$p" in
    server/fastify/*)
      local rest="${p#server/fastify/}"
      # mjs/js → py
      rest=$(echo "$rest" | sed -E 's/\.(mjs|js)$/.py/')
      echo "server/fastapi/$rest"
      ;;
    server/fastapi/*)
      local rest="${p#server/fastapi/}"
      # py → mjs (canonical fastify extension)
      rest=$(echo "$rest" | sed -E 's/\.py$/.mjs/')
      echo "server/fastify/$rest"
      ;;
    *) echo "" ;;
  esac
}

classify() {
  local p="$1"
  case "$p" in
    server/parity/*) echo "parity-contract" ;;
    server/fastify/*)
      local m; m=$(mirror_path "$p")
      if [[ -n "$m" && -e "$m" ]]; then echo "both"
      else echo "fastify-only"
      fi ;;
    server/fastapi/*)
      local m; m=$(mirror_path "$p")
      if [[ -n "$m" && -e "$m" ]]; then echo "both"
      else echo "fastapi-only"
      fi ;;
    *) echo "unrelated" ;;
  esac
}

emit() {
  local p="$1" cls="$2"
  local m; m=$(mirror_path "$p")
  if [[ "$JSON" -eq 1 ]]; then
    jq -nc --arg p "$p" --arg cls "$cls" --arg m "$m" \
      '{path:$p, classification:$cls, mirror: (if $m == "" then null else $m end)}'
  else
    printf '%s | %s\n' "$p" "$cls"
  fi
}

for p in "${PATHS[@]}"; do
  emit "$p" "$(classify "$p")"
done
