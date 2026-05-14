#!/usr/bin/env bash
# Reader/validator for release-manifest TOML files.
# Backed by Python (tomllib) shims under the same lib/ dir. Bash 3.2 compatible.
# shellcheck disable=SC2148

# Resolve lib dir robustly even when sourced.
__MANIFEST_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
: "${MANIFEST_SCHEMA_PATH:=scripts/workspace/release-manifest.schema.json}"

manifest::_python() {
  if [[ -x "server/fastapi/.venv/bin/python" ]]; then
    echo "server/fastapi/.venv/bin/python"
  else
    echo "python3"
  fi
}

manifest::_to_json() {
  local path="$1" py
  py=$(manifest::_python)
  "$py" "$__MANIFEST_LIB_DIR/_toml_to_json.py" < "$path"
}

manifest::load() {
  local path="$1"
  if [[ ! -f "$path" ]]; then
    printf 'manifest::load ERROR: %s not found\n' "$path" >&2
    return 1
  fi
  manifest::_to_json "$path"
}

manifest::release_ref() {
  local path="$1"
  manifest::load "$path" | jq -r '.release_ref'
}

manifest::cut_at() {
  local path="$1"
  manifest::load "$path" | jq -r '.cut_at'
}

manifest::cut_by() {
  local path="$1"
  manifest::load "$path" | jq -r '.cut_by'
}

manifest::sibling_names() {
  local path="$1"
  manifest::load "$path" | jq -r '.sibling[].name'
}

manifest::sibling_sha() {
  local path="$1" name="$2"
  manifest::load "$path" | jq -r --arg n "$name" '.sibling[] | select(.name==$n) | .pinned_sha'
}

manifest::sibling_field() {
  local path="$1" name="$2" field="$3"
  manifest::load "$path" | jq -r --arg n "$name" --arg f "$field" \
    '.sibling[] | select(.name==$n) | .[$f] // ""'
}

manifest::validate() {
  local path="$1" py
  py=$(manifest::_python)
  "$py" "$__MANIFEST_LIB_DIR/_manifest_validate.py" "$path" "$MANIFEST_SCHEMA_PATH"
}
