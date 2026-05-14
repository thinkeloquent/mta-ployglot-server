#!/usr/bin/env bash
# release-assemble-from-siblings.sh — pull every registered sibling subtree at
# its current HEAD SHA (or, when RELEASE_MANIFEST is set, at the SHA the
# manifest pinned). Replaces the orchestrator-driven `make release-assemble`
# legacy logic with a CI-friendly, locally-runnable script.
#
# Modes:
#   (default — workflow path)  Snapshot every sibling's HEAD, pull each
#                              subtree at that pinned SHA. Snapshot written
#                              to /tmp/snapshot.jsonl for the manifest emitter.
#   RELEASE_MANIFEST=<path>    Manifest-driven mode (local reproduction):
#                              ignores live HEAD, pulls each sibling at the
#                              SHA the manifest pinned.
#
# Args:
#   --ref release/<X>          Required. Release branch being assembled.
#   --apply                    Without this, dry-run (snapshot + intended pulls).
#
# Bash 3.2 compatible.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ORCH_LIB="$HERE/orchestrator/lib"

# shellcheck source=orchestrator/lib/log.sh
source "$ORCH_LIB/log.sh"
# shellcheck source=orchestrator/lib/registry.sh
source "$ORCH_LIB/registry.sh"
# shellcheck source=orchestrator/lib/sibling-snapshot.sh
source "$ORCH_LIB/sibling-snapshot.sh"
# shellcheck source=orchestrator/lib/manifest.sh
source "$ORCH_LIB/manifest.sh"

REF=""
APPLY=0
SNAPSHOT_OUT="/tmp/snapshot.jsonl"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ref)            REF="${2:-}"; shift 2 ;;
    --apply)          APPLY=1; shift ;;
    --snapshot-out)   SNAPSHOT_OUT="${2:-}"; shift 2 ;;
    -h|--help)
      cat <<'EOF' >&2
usage: release-assemble-from-siblings.sh --ref release/<X> [--apply] [--snapshot-out PATH]
  RELEASE_MANIFEST=<path>   Use manifest-pinned SHAs instead of live HEAD.
EOF
      exit 64 ;;
    *) log::err "unknown arg: $1"; exit 64 ;;
  esac
done

[[ -n "$REF" ]] || { log::err "--ref release/<X> required"; exit 64; }
case "$REF" in
  release/*) ;;
  *) log::err "REF must start with release/ (got: $REF)"; exit 64 ;;
esac

mkdir -p .dev/release-manifests

# 1) Take a snapshot of every sibling's HEAD up-front. All pulls reference
#    these pinned SHAs so concurrent sibling pushes during assembly don't
#    cause "drift" between siblings.
log::info "snapshotting sibling HEADs → $SNAPSHOT_OUT"
sibling_snapshot::emit > "$SNAPSHOT_OUT"

# 2) Refuse to assemble if any sibling is not hydrated. The workflow runs
#    bootstrap.sh hydrate before this, so missing siblings = setup bug.
not_hydrated=$(jq -r 'select(.status=="not-hydrated") | .name' "$SNAPSHOT_OUT" | tr '\n' ' ')
if [[ -n "${not_hydrated// /}" ]]; then
  log::err "not-hydrated siblings: $not_hydrated"
  log::err "run: ./scripts/workspace/bootstrap.sh hydrate"
  exit 1
fi

# 3) Per-sibling pull. Order is registry order (deterministic).
manifest_path=""
if [[ -n "${RELEASE_MANIFEST:-}" ]]; then
  manifest_path="$RELEASE_MANIFEST"
  if [[ ! -f "$manifest_path" ]]; then
    log::err "RELEASE_MANIFEST=$manifest_path: file not found"
    exit 1
  fi
  log::info "manifest-driven mode: $manifest_path"
fi

while IFS= read -r entry; do
  name=$(jq -r '.name'        <<<"$entry")
  sha=$(jq  -r '.sha'         <<<"$entry")
  remote=$(jq -r '.remote'    <<<"$entry")
  shell_path=$(jq -r '.shell_path' <<<"$entry")

  # Manifest-driven mode: override sha from manifest.
  if [[ -n "$manifest_path" ]]; then
    sha=$(manifest::sibling_sha "$manifest_path" "$name" || echo "")
    if [[ -z "$sha" ]]; then
      log::err "manifest does not list sibling: $name"
      exit 1
    fi
  fi

  log::info "subtree pull: $name @ $sha → $shell_path"

  if [[ "$APPLY" -eq 0 ]]; then
    log::info "  (dry-run; pass --apply to perform)"
    continue
  fi

  # Decide add vs pull: if the prefix already exists in HEAD's tree, pull;
  # otherwise this is the first-time `add`. Both use --squash.
  if git ls-tree -r --name-only HEAD -- "$shell_path" 2>/dev/null | grep -q .; then
    git subtree pull --squash --prefix="$shell_path" "$remote" "$sha" \
      -m "subtree($name): pull at $sha"
  else
    git subtree add  --squash --prefix="$shell_path" "$remote" "$sha" \
      -m "subtree($name): add at $sha"
  fi
done < <(jq -c 'select(.status=="hydrated")' "$SNAPSHOT_OUT")

if [[ "$APPLY" -eq 0 ]]; then
  log::info "dry-run complete; pass --apply to commit subtree pulls"
  exit 0
fi

# 4) Existing static guard — every newly added subtree must be --squash.
make -s subtree-lint

log::ok "assembly complete: $(git rev-parse HEAD)"
