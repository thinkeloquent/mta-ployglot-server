#!/usr/bin/env bash
# Extract every env key referenced by either server twin.
#
# DEVIATION FROM PLAN: the plan assumed a vault.get('KEY') accessor, but the
# real codebase reads from process.env.KEY (mjs) and os.environ.get("KEY") (py)
# directly. We extract those literal patterns. The target stays named
# "vault-check" so Checklist.md / pre-push references continue to work.
#
# Usage:
#   extract-vault-keys.sh [--twin fastify|fastapi|both] [--json]

set -euo pipefail

TWIN=both
JSON=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --twin) TWIN="${2:-both}"; shift 2 ;;
    --json) JSON=1; shift ;;
    *) printf 'unknown arg: %s\n' "$1" >&2; exit 64 ;;
  esac
done

# Patterns are written without back-references so they work under both BSD/GNU
# grep AND ugrep (which the user has installed; ugrep rejects \1 in patterns).
# We use a character class [\"'] for either-quote and accept a tiny theoretical
# risk of mismatched quotes (zero in real code — would be a syntax error).

extract_one_twin() {
  local twin="$1"
  local dir="server/$twin"
  [[ -d "$dir" ]] || return 0

  local file_globs grep_patterns sed_strip
  if [[ "$twin" == "fastify" ]]; then
    # process.env.IDENT  |  process.env["IDENT"]  |  process.env['IDENT']  |  vault.get("IDENT")
    grep -rEn --include='*.mjs' --include='*.js' \
      --exclude-dir=node_modules --exclude-dir=.venv --exclude-dir=__pycache__ --exclude-dir=dist --exclude-dir=build \
      -e 'process\.env\.[A-Z_][A-Z0-9_]*' \
      -e 'process\.env\[["\x27][A-Z_][A-Z0-9_]*["\x27]\]' \
      -e 'vault\.get\(["\x27][A-Z_][A-Z0-9_]*["\x27]\)' \
      "$dir" 2>/dev/null \
      | while IFS=: read -r file line content; do
          echo "$content" \
            | grep -oE 'process\.env\.[A-Z_][A-Z0-9_]*|process\.env\[["\x27][A-Z_][A-Z0-9_]*["\x27]\]|vault\.get\(["\x27][A-Z_][A-Z0-9_]*["\x27]\)' \
            | sed -E 's/^process\.env\.//; s/^process\.env\[["\x27]//; s/["\x27]\]$//; s/^vault\.get\(["\x27]//; s/["\x27]\)$//' \
            | while read -r key; do
                [[ -n "$key" ]] && printf '%s\t%s\t%s:%s\n' "$key" "$twin" "$file" "$line"
              done
        done
  elif [[ "$twin" == "fastapi" ]]; then
    grep -rEn --include='*.py' \
      --exclude-dir=node_modules --exclude-dir=.venv --exclude-dir=__pycache__ --exclude-dir=dist --exclude-dir=build \
      -e 'os\.environ\.get\(["\x27][A-Z_][A-Z0-9_]*["\x27]' \
      -e 'os\.environ\[["\x27][A-Z_][A-Z0-9_]*["\x27]\]' \
      -e 'vault\.get\(["\x27][A-Z_][A-Z0-9_]*["\x27]\)' \
      "$dir" 2>/dev/null \
      | while IFS=: read -r file line content; do
          echo "$content" \
            | grep -oE 'os\.environ\.get\(["\x27][A-Z_][A-Z0-9_]*["\x27]|os\.environ\[["\x27][A-Z_][A-Z0-9_]*["\x27]\]|vault\.get\(["\x27][A-Z_][A-Z0-9_]*["\x27]\)' \
            | sed -E 's/^os\.environ\.get\(["\x27]//; s/^os\.environ\[["\x27]//; s/["\x27]\]$//; s/["\x27]$//; s/^vault\.get\(["\x27]//; s/["\x27]\)$//' \
            | while read -r key; do
                [[ -n "$key" ]] && printf '%s\t%s\t%s:%s\n' "$key" "$twin" "$file" "$line"
              done
        done
  fi
}

RAW=$(mktemp)
trap 'rm -f "$RAW"' EXIT

case "$TWIN" in
  fastify)  extract_one_twin fastify > "$RAW" ;;
  fastapi)  extract_one_twin fastapi > "$RAW" ;;
  both)     { extract_one_twin fastify; extract_one_twin fastapi; } > "$RAW" ;;
  *) printf 'unknown twin: %s\n' "$TWIN" >&2; exit 64 ;;
esac

# Aggregate per (key, twin)
if [[ "$JSON" -eq 1 ]]; then
  sort -u "$RAW" | awk -F'\t' '
    { key=$1; twin=$2; site=$3;
      k=key"\t"twin;
      if (!(k in seen)) { keys[++n]=k; seen[k]=1; sites[k]=site; count[k]=1 }
      else { sites[k]=sites[k]";"site; count[k]++ }
    }
    END {
      for (i=1; i<=n; i++) {
        k=keys[i]; split(k, p, "\t"); key=p[1]; twin=p[2];
        printf "{\"key\":\"%s\",\"twin\":\"%s\",\"callsites\":\"%s\",\"count\":%d}\n", key, twin, sites[k], count[k];
      }
    }' | jq -c '.callsites |= split(";")'
else
  sort -u "$RAW" | awk -F'\t' '
    { key=$1; twin=$2; site=$3;
      k=key"\t"twin;
      if (!(k in seen)) { keys[++n]=k; seen[k]=1; first[k]=site; count[k]=1 }
      else { count[k]++ }
    }
    END {
      printf "%-32s %-10s %5s   %s\n", "KEY", "TWIN", "N", "first callsite";
      for (i=1; i<=n; i++) {
        k=keys[i]; split(k, p, "\t");
        printf "%-32s %-10s %5d   %s\n", p[1], p[2], count[k], first[k];
      }
    }'
fi
