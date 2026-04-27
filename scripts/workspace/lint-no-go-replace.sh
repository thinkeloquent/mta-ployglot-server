#!/usr/bin/env bash
# lint-no-go-replace.sh — refuse `replace` directives in any sibling's go.mod.
#
# Workspace mode (go.work + `use`) supersedes per-module replace directives.
# A `replace` line in a sibling's go.mod silently overrides workspace resolution
# and is the exact failure mode the registry pattern is designed to prevent.
#
# Wired into Makefile.lang.go as a `lint` prerequisite (Story 03/02).
#
# Exits:
#   0   no replace directives found
#   1   one or more replace directives detected (lists offending files)
#   127 missing python3 / tomllib
set -euo pipefail

SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SELF_DIR/../.." && pwd)"
REG="${WORKSPACE_REGISTRY:-$ROOT_DIR/workspace.toml}"

if ! command -v python3 >/dev/null 2>&1; then
  echo "missing: python3 (3.11+ for tomllib)" >&2
  exit 127
fi

GO_PATHS=()
while IFS= read -r line; do
  [[ -n "$line" ]] && GO_PATHS+=("$line")
done < <(python3 - "$REG" <<'PY'
import sys, tomllib
with open(sys.argv[1], "rb") as f:
    doc = tomllib.load(f)
for e in doc.get("entry", []):
    if e.get("language") in ("go", "mixed"):
        print(e["local_path"])
PY
)

fail=0
for p in "${GO_PATHS[@]}"; do
  # Resolve relative to ROOT_DIR if not absolute.
  if [[ "$p" != /* ]]; then
    p="$ROOT_DIR/$p"
  fi
  modf="$p/go.mod"
  [[ -f "$modf" ]] || continue
  if grep -nE '^[[:space:]]*replace[[:space:]]' "$modf"; then
    echo "FAIL: $modf contains a replace directive" >&2
    fail=1
  fi
done

if [[ $fail -eq 0 ]]; then
  echo "ok: no replace directives across ${#GO_PATHS[@]} sibling path(s)"
fi
exit $fail
