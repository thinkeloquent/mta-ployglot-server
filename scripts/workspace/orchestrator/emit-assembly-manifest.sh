#!/usr/bin/env bash
# emit-assembly-manifest.sh — read /tmp/snapshot.jsonl (or --snapshot PATH),
# write the release-manifest TOML + JSON-line projection at
# .dev/release-manifests/<ref-slug>.toml, validate it, and (when --commit)
# stage + commit both files into the release branch.
#
# Run AFTER release-assemble-from-siblings.sh --apply so the snapshot exists.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/log.sh
source "$HERE/lib/log.sh"
# shellcheck source=lib/manifest-emit.sh
source "$HERE/lib/manifest-emit.sh"

REF=""
SNAPSHOT="/tmp/snapshot.jsonl"
COMMIT=1   # default: commit (workflow path); pass --no-commit for dry-run

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ref)         REF="${2:-}"; shift 2 ;;
    --snapshot)    SNAPSHOT="${2:-}"; shift 2 ;;
    --no-commit)   COMMIT=0; shift ;;
    -h|--help)
      cat <<'EOF' >&2
usage: emit-assembly-manifest.sh --ref release/<X> [--snapshot PATH] [--no-commit]
EOF
      exit 64 ;;
    *) log::err "unknown arg: $1"; exit 64 ;;
  esac
done

[[ -n "$REF" ]] || { log::err "--ref release/<X> required"; exit 64; }
[[ -f "$SNAPSHOT" ]] || {
  log::err "snapshot not found at $SNAPSHOT"
  log::err "run release-assemble-from-siblings.sh --apply first"
  exit 1
}

# Slug: release/2026.05.0 → release-2026-05-0
slug=$(printf '%s' "$REF" | tr '/.' '-' | tr -d ' ')
manifest_path=".dev/release-manifests/${slug}.toml"
jsonl_path="${manifest_path}.lock.jsonl"
mkdir -p "$(dirname "$manifest_path")"

# Pipe snapshot rows → "name sha from_ref local_path" tuples → emitter.
jq -r 'select(.status=="hydrated") | "\(.name) \(.sha) \(.from_ref) \(.local_path)"' "$SNAPSHOT" \
  | manifest::emit "$manifest_path" "$REF"

manifest::emit_jsonl "$manifest_path" "$jsonl_path"

# Validate the freshly-emitted manifest before any commit.
manifest::validate "$manifest_path"

log::ok "manifest emitted: $manifest_path"
log::ok "jsonl projection: $jsonl_path"

if [[ "$COMMIT" -eq 1 ]]; then
  git add "$manifest_path" "$jsonl_path"
  if git diff --cached --quiet; then
    log::info "manifest unchanged — no-op commit skipped"
  else
    git commit -m "release-manifest: $REF"
    log::ok "committed: $(git rev-parse --short HEAD)"
  fi
fi
