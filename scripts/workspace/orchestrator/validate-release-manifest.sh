#!/usr/bin/env bash
# validate-release-manifest.sh — pre-assembly validator. Run before
# `make release-assemble REF=... MANIFEST=...` invokes the shared assembly
# script, so a bad manifest fails before any subtree pull happens.
#
# Checks:
#   1. Schema validation via lib/manifest.sh::validate (delegates to
#      _manifest_validate.py).
#   2. release_ref in the manifest matches the supplied --ref.
#   3. Every sibling listed in workspace.toml is present in the manifest
#      (no silent skips). Missing → ERROR.
#   4. Manifest has no "extra" siblings unknown to the registry. Extra → WARN
#      but exit 0 (registry may have shrunk since the manifest was emitted).
#
# Standalone-friendly: also useful for ad-hoc sanity checks of
# hand-edited manifests.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/log.sh
source "$HERE/lib/log.sh"
# shellcheck source=lib/registry.sh
source "$HERE/lib/registry.sh"
# shellcheck source=lib/manifest.sh
source "$HERE/lib/manifest.sh"

MANIFEST=""
REF=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --manifest) MANIFEST="${2:-}"; shift 2 ;;
    --ref)      REF="${2:-}"; shift 2 ;;
    -h|--help)
      echo "usage: validate-release-manifest.sh --manifest PATH --ref release/<X>" >&2
      exit 64 ;;
    *) log::err "unknown arg: $1"; exit 64 ;;
  esac
done

[[ -n "$MANIFEST" ]] || { log::err "--manifest PATH required"; exit 64; }
[[ -n "$REF"      ]] || { log::err "--ref release/<X> required"; exit 64; }
[[ -f "$MANIFEST" ]] || { log::err "manifest not found: $MANIFEST"; exit 1; }

# 1) Schema check.
manifest::validate "$MANIFEST"

# 2) Ref match.
manifest_ref=$(manifest::release_ref "$MANIFEST")
if [[ "$manifest_ref" != "$REF" ]]; then
  log::err "manifest release_ref ($manifest_ref) != supplied REF ($REF)"
  exit 1
fi

# 3+4) Registry vs manifest sibling-name comparison.
registry_names_file=$(mktemp -t manifest-validate.reg.XXXXXX)
manifest_names_file=$(mktemp -t manifest-validate.man.XXXXXX)
trap 'rm -f "$registry_names_file" "$manifest_names_file"' EXIT

registry::sibling_names | sort -u > "$registry_names_file"
manifest::sibling_names "$MANIFEST" | sort -u > "$manifest_names_file"

missing=$(comm -23 "$registry_names_file" "$manifest_names_file")
extra=$(comm   -13 "$registry_names_file" "$manifest_names_file")

if [[ -n "$missing" ]]; then
  log::err "manifest missing siblings present in registry:"
  printf '  %s\n' $missing >&2
  exit 1
fi

if [[ -n "$extra" ]]; then
  log::warn "manifest contains siblings not in current registry (stale entries):"
  printf '  %s\n' $extra >&2
fi

log::ok "manifest valid for $REF"
