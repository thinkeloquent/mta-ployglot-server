#!/usr/bin/env bash
# Emitter for release-manifest TOML + JSON-line projection.
# Output is sorted by sibling name for deterministic diffs across runs.
# shellcheck disable=SC2148

__MANIFEST_EMIT_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=manifest.sh
source "$__MANIFEST_EMIT_LIB_DIR/manifest.sh"

# manifest::emit <out-path> <release-ref>
#   stdin: one tuple per line — "name pinned_sha pinned_from_ref local_path"
#          (whitespace-separated; values must not contain spaces)
#   env:   MANIFEST_CUT_AT (override timestamp; useful for tests),
#          MANIFEST_CUT_BY (override author; useful for tests)
manifest::emit() {
  local out="$1" release_ref="$2"
  local cut_at="${MANIFEST_CUT_AT:-}"
  local cut_by="${MANIFEST_CUT_BY:-}"
  if [[ -z "$cut_at" ]]; then
    cut_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  fi
  if [[ -z "$cut_by" ]]; then
    local user_name user_email
    user_name=$(git config user.name 2>/dev/null || echo "unknown")
    user_email=$(git config user.email 2>/dev/null || echo "unknown@local")
    cut_by="$user_name <$user_email>"
  fi

  local tmp_sorted
  tmp_sorted=$(mktemp -t manifest-emit.XXXXXX)
  # Sort tuples by sibling name (column 1) for deterministic output.
  sort -k1,1 > "$tmp_sorted"

  {
    printf 'release_ref = "%s"\n' "$release_ref"
    printf 'cut_at = "%s"\n' "$cut_at"
    printf 'cut_by = "%s"\n' "$cut_by"
    printf '\n'
    while read -r name sha from_ref local_path; do
      [[ -z "$name" ]] && continue
      printf '[[sibling]]\n'
      printf 'name = "%s"\n' "$name"
      printf 'pinned_sha = "%s"\n' "$sha"
      printf 'pinned_from_ref = "%s"\n' "$from_ref"
      printf 'local_path = "%s"\n' "$local_path"
      printf '\n'
    done < "$tmp_sorted"
  } > "$out"

  rm -f "$tmp_sorted"
}

# manifest::emit_jsonl <toml-path> <out-jsonl-path>
manifest::emit_jsonl() {
  local toml="$1" out="$2"
  manifest::load "$toml" | jq -c '.sibling[]' > "$out"
}
