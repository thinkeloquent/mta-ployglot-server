#!/usr/bin/env bash
# Captures one JSON line per registered sibling with its current HEAD SHA
# and registry metadata (remote, shell_path, local_path, default_ref).
# Used by release-assemble-from-siblings.sh to pin all subtree pulls to a
# single, frozen snapshot taken at assembly start.
# shellcheck disable=SC2148

__SNAPSHOT_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=registry.sh
source "$__SNAPSHOT_LIB_DIR/registry.sh"

# sibling_snapshot::emit
#   stdout: one JSON object per sibling, fields: name, status,
#           sha, from_ref, remote, shell_path, local_path
#   status="hydrated" when .git exists; "not-hydrated" otherwise.
sibling_snapshot::emit() {
  registry::sibling_names | while IFS= read -r name; do
    local path remote shell_path default_ref head_sha from_ref
    path=$(registry::sibling_path "$name")
    remote=$(registry::sibling_remote "$name")
    shell_path=$(registry::sibling_shell_path "$name")
    default_ref=$(registry::sibling_default_ref "$name")
    [[ -z "$default_ref" ]] && default_ref="main"

    if [[ ! -d "$path/.git" ]]; then
      jq -nc \
        --arg name "$name" \
        --arg local_path "$path" \
        --arg remote "$remote" \
        --arg shell_path "$shell_path" \
        --arg default_ref "$default_ref" \
        '{name:$name, status:"not-hydrated", local_path:$local_path, remote:$remote, shell_path:$shell_path, default_ref:$default_ref}'
      continue
    fi

    head_sha=$(git -C "$path" rev-parse HEAD 2>/dev/null || echo "")
    from_ref=$(git -C "$path" symbolic-ref --short HEAD 2>/dev/null || echo "$default_ref")

    jq -nc \
      --arg name "$name" \
      --arg sha "$head_sha" \
      --arg from_ref "$from_ref" \
      --arg remote "$remote" \
      --arg shell_path "$shell_path" \
      --arg local_path "$path" \
      --arg default_ref "$default_ref" \
      '{name:$name, status:"hydrated", sha:$sha, from_ref:$from_ref, remote:$remote, shell_path:$shell_path, local_path:$local_path, default_ref:$default_ref}'
  done
}
