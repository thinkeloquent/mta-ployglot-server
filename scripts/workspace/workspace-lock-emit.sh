#!/usr/bin/env bash
# workspace-lock-emit.sh — emit .dev/workspace.toml.lock.json from workspace.toml.
#
# This is a LOCAL, machine-readable projection of the registry. The
# canonical SSOT is workspace.toml; this file exists so that consumers
# without a TOML parser (Node scripts, GitHub Actions, future agents) can
# read a stable JSON shape without taking on a TOML dependency.
#
# It is NOT committed — .dev/ is .gitignored. Regenerate with `make init`,
# `make workspace-lock-emit`, or as part of `make bootstrap`'s emit chain.
#
# Output shape (workspace.toml.lock.json):
#   {
#     "schema_version": 1,
#     "source":         "workspace.toml",
#     "source_sha256":  "<hex digest of workspace.toml>",
#     "generator":      "scripts/workspace/workspace-lock-emit.sh",
#     "entry_count":    <int>,
#     "entries": [
#       {
#         "name":           "...",
#         "remote":         "...",
#         "local_path":     "...",
#         "shell_path":     "...",
#         "language":       "...",
#         "subtree_prefix": "...",
#         "default_ref":    "main"           (defaulted if absent in TOML)
#       }, ...
#     ]
#   }
#
# Modes:
#   (default)    write .dev/workspace.toml.lock.json (creating .dev/ if needed)
#   --check      compare a regenerated projection against the cached file;
#                exit non-zero with a unified diff if they differ. Useful
#                locally to confirm the cache is fresh; CI re-emits before
#                checking.
#
# Determinism: identical workspace.toml → byte-identical workspace.toml.lock.json
# (preserves entry order; uses sorted JSON keys; trailing newline).
#
# Exits:
#   0   wrote (or --check passed)
#   65  registry validation failed (delegated to validate.sh)
#   66  registry not found
#   69  --check failed: .dev/workspace.toml.lock.json is stale or missing
#   127 missing python3 / tomllib
set -euo pipefail
IFS=$'\n\t'

SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SELF_DIR/../.." && pwd)"
REG="${WORKSPACE_REGISTRY:-$ROOT_DIR/workspace.toml}"
OUT="${WORKSPACE_LOCK_OUT:-$ROOT_DIR/.dev/workspace.toml.lock.json}"

MODE="emit"
case "${1:-}" in
  --check) MODE="check" ;;
  -h|--help)
    cat <<USAGE
workspace-lock-emit.sh — emit .dev/workspace.toml.lock.json from workspace.toml

USAGE:
  workspace-lock-emit.sh           # write .dev/workspace.toml.lock.json
  workspace-lock-emit.sh --check   # fail if cached file is stale or missing

ENV:
  WORKSPACE_REGISTRY               path to workspace.toml (default: <root>/workspace.toml)
  WORKSPACE_LOCK_OUT               output path           (default: <root>/.dev/workspace.toml.lock.json)
USAGE
    exit 0 ;;
  "") ;;
  *) echo "unknown flag: $1" >&2; exit 64 ;;
esac

if ! command -v python3 >/dev/null 2>&1; then
  echo "missing: python3 (3.11+ for tomllib)" >&2
  exit 127
fi

if [[ ! -f "$REG" ]]; then
  echo "FAIL: registry not found: $REG" >&2
  exit 66
fi

# Validate up front (same as bootstrap.sh) so an invalid registry never
# produces a "valid" lock file.
if [[ -x "$SELF_DIR/validate.sh" ]]; then
  if ! "$SELF_DIR/validate.sh" "$REG" >/dev/null; then
    echo "FAIL: $REG did not validate" >&2
    exit 65
  fi
fi

TMP="$(mktemp -t workspace-lock.XXXXXX.json)"
trap 'rm -f "$TMP"' EXIT

# Build the projection. Keys are sorted, indent=2, trailing newline so the
# file is diff-friendly and re-runs are byte-identical.
python3 - "$REG" >"$TMP" <<'PY'
import hashlib, json, sys, tomllib
from pathlib import Path

reg_path = Path(sys.argv[1])
with reg_path.open("rb") as f:
    raw = f.read()
doc = tomllib.loads(raw.decode("utf-8"))

entries = []
for e in doc.get("entry", []):
    entries.append({
        "name":           e["name"],
        "remote":         e["remote"],
        "local_path":     e["local_path"],
        "shell_path":     e["shell_path"],
        "language":       e["language"],
        "subtree_prefix": e["subtree_prefix"],
        "default_ref":    e.get("default_ref", "main"),
    })

projection = {
    "schema_version": 1,
    "source":         reg_path.name,
    "source_sha256":  hashlib.sha256(raw).hexdigest(),
    "generator":      "scripts/workspace/workspace-lock-emit.sh",
    "entry_count":    len(entries),
    "entries":        entries,
}

json.dump(projection, sys.stdout, indent=2, sort_keys=True)
sys.stdout.write("\n")
PY

if [[ "$MODE" == "check" ]]; then
  if [[ ! -f "$OUT" ]]; then
    echo "FAIL: $OUT does not exist; run scripts/workspace/workspace-lock-emit.sh" >&2
    exit 69
  fi
  if ! diff -u "$OUT" "$TMP" >/tmp/workspace-lock-diff.$$ 2>&1; then
    echo "FAIL: $OUT is stale relative to $REG" >&2
    echo "  re-run: bash scripts/workspace/workspace-lock-emit.sh" >&2
    echo "----- diff (committed → regenerated) -----" >&2
    cat /tmp/workspace-lock-diff.$$ >&2
    rm -f /tmp/workspace-lock-diff.$$
    exit 69
  fi
  rm -f /tmp/workspace-lock-diff.$$
  echo "ok: $OUT in sync with $REG"
  exit 0
fi

mkdir -p "$(dirname "$OUT")"
mv "$TMP" "$OUT"
trap - EXIT
echo "wrote $OUT"
