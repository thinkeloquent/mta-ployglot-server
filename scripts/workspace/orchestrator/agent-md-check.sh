#!/usr/bin/env bash
# agent-md-check.sh — content-hash gate for per-twin .agent.md files.
#
# Each .agent.md should embed a marker like:
#   <!-- surface-hash: 1a2b3c4d5e6f7890 -->
#
# The hash is the sha256 prefix (16 chars) of the concatenated content of the
# twin's surface dirs (config/{environment,lifecycles,routes} + server/parity).
# A mismatch means the surface changed but .agent.md wasn't regenerated.
#
# Modes:
#   (no flag)    — check; exit non-zero on STALE or NEEDS-MIGRATION
#   --migrate    — auto-add the marker if missing (one-time bootstrap)
#   --json       — JSON-line output

set -euo pipefail

JSON=0
MIGRATE=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --json)    JSON=1; shift ;;
    --migrate) MIGRATE=1; shift ;;
    *) printf 'unknown arg: %s\n' "$1" >&2; exit 64 ;;
  esac
done

# Compute the surface hash for one twin.
compute_surface_hash() {
  local twin="$1"
  local dirs=()
  for sub in routes lifecycles environment; do
    [[ -d "server/$twin/config/$sub" ]] && dirs+=("server/$twin/config/$sub")
  done
  [[ -d "server/parity" ]] && dirs+=("server/parity")
  [[ "${#dirs[@]}" -gt 0 ]] || { echo ""; return 0; }

  # LC_ALL=C ensures byte-order sort so the hash is stable across macOS (UTF-8
  # default locale puts `_foo.py` before `10_foo.py`) and Linux CI (C locale
  # does the opposite). Without this the gate spuriously fails per-platform.
  find "${dirs[@]}" -type f \( -name '*.mjs' -o -name '*.py' -o -name '*.js' \) -not -path '*/node_modules/*' -not -path '*/__pycache__/*' -not -path '*/.venv/*' \
    | LC_ALL=C sort \
    | xargs cat 2>/dev/null \
    | shasum -a 256 \
    | cut -c1-16
}

# Read embedded surface-hash marker from .agent.md. Returns empty string if
# no marker present. Always exits 0 so caller doesn't trip pipefail/set-e.
read_embedded_hash() {
  local f="$1"
  [[ -f "$f" ]] || { echo ""; return 0; }
  local match
  match=$(grep -oE '<!-- surface-hash: [a-f0-9]{16} -->' "$f" 2>/dev/null | head -1 || true)
  if [[ -n "$match" ]]; then
    echo "$match" | grep -oE '[a-f0-9]{16}' || true
  else
    echo ""
  fi
}

# Write/replace the surface-hash marker.
write_embedded_hash() {
  local f="$1" hash="$2"
  if grep -q '<!-- surface-hash: ' "$f" 2>/dev/null; then
    # Replace existing marker (cross-platform sed)
    sed -i.bak -E "s|<!-- surface-hash: [a-f0-9]+ -->|<!-- surface-hash: $hash -->|" "$f"
    rm -f "$f.bak"
  else
    # Append new marker on a new line at end
    printf '\n<!-- surface-hash: %s -->\n' "$hash" >> "$f"
  fi
}

emit() {
  local path="$1" status="$2" embedded="$3" current="$4"
  if [[ "$JSON" -eq 1 ]]; then
    jq -nc --arg path "$path" --arg status "$status" --arg embedded "$embedded" --arg current "$current" \
      '{path:$path, status:$status, embedded_hash:$embedded, current_hash:$current}'
  else
    case "$status" in
      fresh)            printf '✓ FRESH:            %s\n' "$path" ;;
      stale)            printf '✗ STALE:            %s (embedded=%s, current=%s)\n' "$path" "$embedded" "$current" >&2 ;;
      needs-migration)  printf '! NEEDS-MIGRATION:  %s (no marker; run --migrate)\n' "$path" >&2 ;;
      migrated)         printf '+ MIGRATED:         %s (added surface-hash: %s)\n' "$path" "$current" ;;
      missing)          printf '! MISSING:          %s\n' "$path" >&2 ;;
    esac
  fi
}

FAIL=0

for twin in fastify fastapi; do
  agent_md="server/$twin/.agent.md"
  current=$(compute_surface_hash "$twin")
  [[ -z "$current" ]] && current="(no-surface-files)"

  if [[ ! -f "$agent_md" ]]; then
    emit "$agent_md" missing "" "$current"
    FAIL=$((FAIL + 1))
    continue
  fi

  embedded=$(read_embedded_hash "$agent_md")

  if [[ -z "$embedded" ]]; then
    if [[ "$MIGRATE" -eq 1 ]]; then
      write_embedded_hash "$agent_md" "$current"
      emit "$agent_md" migrated "" "$current"
    else
      emit "$agent_md" needs-migration "" "$current"
      FAIL=$((FAIL + 1))
    fi
    continue
  fi

  if [[ "$embedded" == "$current" ]]; then
    emit "$agent_md" fresh "$embedded" "$current"
  else
    if [[ "$MIGRATE" -eq 1 ]]; then
      write_embedded_hash "$agent_md" "$current"
      emit "$agent_md" migrated "$embedded" "$current"
    else
      emit "$agent_md" stale "$embedded" "$current"
      FAIL=$((FAIL + 1))
    fi
  fi
done

exit "$FAIL"
