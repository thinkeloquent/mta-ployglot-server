#!/usr/bin/env bash
# validate.sh — validate workspace.toml against scripts/workspace/schema/workspace.schema.json
#
# Exits:
#   0   ok
#   65  duplicate `entry.name` (data error; jsonschema can't express uniqueness on a single field)
#   66  schema validation failure (missing/invalid field)
#   67  malformed TOML
#   127 missing dependency: check-jsonschema or python3
#
# Usage:
#   bash scripts/workspace/validate.sh [path/to/workspace.toml]
#   default: workspace.toml at the repo root
set -euo pipefail

SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCHEMA="$SELF_DIR/schema/workspace.schema.json"
REG="${1:-workspace.toml}"

if [[ ! -f "$REG" ]]; then
  echo "FAIL: registry not found: $REG" >&2
  exit 66
fi
if [[ ! -f "$SCHEMA" ]]; then
  echo "FAIL: schema not found: $SCHEMA" >&2
  exit 66
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "missing: python3 (3.11+ for tomllib)" >&2
  exit 127
fi

if ! command -v check-jsonschema >/dev/null 2>&1; then
  echo "missing: check-jsonschema" >&2
  echo "  install: pip install check-jsonschema  (or: uv pip install --system check-jsonschema)" >&2
  exit 127
fi

JSON_TMP="$(mktemp -t workspace-toml.XXXXXX.json)"
trap 'rm -f "$JSON_TMP"' EXIT

# TOML → JSON. tomllib is stdlib in Python 3.11+; fail clearly on older runtimes.
if ! python3 - "$REG" >"$JSON_TMP" <<'PY' 2>/tmp/workspace-toml-err.$$
import json, sys
try:
    import tomllib
except ModuleNotFoundError:
    sys.stderr.write("python3 >= 3.11 required (tomllib); current: %s\n" % sys.version.split()[0])
    sys.exit(127)
try:
    with open(sys.argv[1], "rb") as f:
        doc = tomllib.load(f)
except tomllib.TOMLDecodeError as e:
    sys.stderr.write(f"malformed TOML: {e}\n")
    sys.exit(67)
json.dump(doc, sys.stdout)
PY
then
  rc=$?
  cat /tmp/workspace-toml-err.$$ >&2 || true
  rm -f /tmp/workspace-toml-err.$$
  exit "$rc"
fi
rm -f /tmp/workspace-toml-err.$$

# Schema check (line/column pointers come from check-jsonschema's default output).
if ! check-jsonschema --schemafile "$SCHEMA" "$JSON_TMP"; then
  echo "FAIL: $REG does not satisfy $SCHEMA" >&2
  exit 66
fi

# Uniqueness on entry.name — JSON Schema cannot express it natively.
DUPES="$(python3 - "$JSON_TMP" <<'PY'
import json, collections, sys
doc = json.load(open(sys.argv[1]))
names = [e["name"] for e in doc.get("entry", [])]
dupes = sorted(n for n, c in collections.Counter(names).items() if c > 1)
if dupes:
    print("\n".join(dupes))
PY
)"
if [[ -n "$DUPES" ]]; then
  echo "FAIL: duplicate entry.name values:" >&2
  while IFS= read -r d; do echo "  - $d" >&2; done <<< "$DUPES"
  exit 65
fi

echo "ok: $REG"
