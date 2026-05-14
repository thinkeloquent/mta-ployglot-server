#!/usr/bin/env bash
# Reader for .dev/workspace.toml.lock.json.
# Exposes registry::* functions used by every sibling-spanning helper.
# shellcheck disable=SC2148

# Override path for tests; default is the lock file in the orchestration root.
: "${ORCH_REGISTRY_LOCK_PATH:=.dev/workspace.toml.lock.json}"

registry::_lock_path() {
  printf '%s\n' "$ORCH_REGISTRY_LOCK_PATH"
}

registry::_require_lock() {
  local p; p=$(registry::_lock_path)
  if [[ ! -f "$p" ]]; then
    printf 'ERROR: registry lock file not found at %s — run scripts/workspace/bootstrap.sh emit\n' "$p" >&2
    return 1
  fi
}

# Print every sibling name, one per line, in registry order.
registry::sibling_names() {
  registry::_require_lock || return 1
  jq -r '.entries[].name' "$(registry::_lock_path)"
}

# Print a single field for a single sibling. Empty string if not found.
registry::_field() {
  local name="$1" field="$2"
  registry::_require_lock || return 1
  jq -r --arg n "$name" --arg f "$field" \
    '.entries[] | select(.name == $n) | (.[$f] // "")' \
    "$(registry::_lock_path)"
}

registry::sibling_path()        { registry::_field "$1" local_path; }
registry::sibling_remote()      { registry::_field "$1" remote; }
registry::sibling_shell_path()  { registry::_field "$1" shell_path; }
registry::sibling_language()    { registry::_field "$1" language; }
registry::sibling_default_ref() { registry::_field "$1" default_ref; }

# Filter sibling names by language (node | python | mixed | go | rust | all).
registry::sibling_names_by_lang() {
  local lang="$1"
  registry::_require_lock || return 1
  if [[ "$lang" == "all" ]]; then
    jq -r '.entries[].name' "$(registry::_lock_path)"
  else
    jq -r --arg l "$lang" '.entries[] | select(.language == $l) | .name' "$(registry::_lock_path)"
  fi
}
