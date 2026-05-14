#!/usr/bin/env bash
# scripts/workspace/print-registry.sh — emit workspace.toml as a Markdown table.
#
# Usage: bash scripts/workspace/print-registry.sh [path/to/workspace.toml]
#
# Pure awk; no jq/yq dependency. Fields: name | language | local_path | shell_path.

set -euo pipefail

WORKSPACE="${1:-$(dirname "$0")/../../workspace.toml}"
test -f "$WORKSPACE" || { echo "no such file: $WORKSPACE" >&2; exit 1; }

awk '
  BEGIN {
    print "| name | language | local_path | shell_path |"
    print "| ---- | -------- | ---------- | ---------- |"
    in_entry = 0
    name = lang = local = shell = ""
  }
  /^\[\[entry\]\]/ {
    if (in_entry && name != "") {
      printf("| `%s` | %s | `%s` | `%s` |\n", name, lang, local, shell)
    }
    in_entry = 1
    name = lang = local = shell = ""
    next
  }
  in_entry && /^name[[:space:]]*=/      { gsub(/^[^"]*"|"$/, "", $0); name = $0 }
  in_entry && /^language[[:space:]]*=/  { gsub(/^[^"]*"|"$/, "", $0); lang = $0 }
  in_entry && /^local_path[[:space:]]*=/ { gsub(/^[^"]*"|"$/, "", $0); local = $0 }
  in_entry && /^shell_path[[:space:]]*=/ { gsub(/^[^"]*"|"$/, "", $0); shell = $0 }
  END {
    if (in_entry && name != "") {
      printf("| `%s` | %s | `%s` | `%s` |\n", name, lang, local, shell)
    }
  }
' "$WORKSPACE"
