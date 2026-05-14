#!/usr/bin/env bash
# min-release-age.sh — apply a "package release age cooldown" across the
# JS + Python toolchains used by this repo, repo-local.
#
# A package version published less than N days ago is quarantined: the package
# manager refuses to install it. Mitigates supply-chain attacks where a
# malicious release is yanked within hours of publication (shai-hulud, et al.).
#
# Scope is REPO-LOCAL only — no global user config is mutated. Files touched:
#   .npmrc                       (root)        npm  : min-release-age = <days>
#   pnpm-workspace.yaml          (root)        pnpm : minimumReleaseAge: <minutes>   [only if file exists, or --create-pnpm]
#   uv.toml                      (root)        uv   : exclude-newer = "<days> days"
#
# Poetry and pip have no native release-age flag; `status` prints guidance for
# those (Renovate / Dependabot `minimumReleaseAge`, or pip `--uploaded-prior-to`).
#
# USAGE:
#   min-release-age.sh apply   [--days N] [--create-pnpm]
#   min-release-age.sh remove
#   min-release-age.sh status
#   min-release-age.sh -h | --help
#
# DEFAULTS:
#   --days 7   (npm=7, pnpm=10080min, uv="7 days")
#
# EXIT:
#   0   success
#   64  unknown flag / bad usage (EX_USAGE)
#   65  file edit failed
set -euo pipefail
IFS=$'\n\t'

SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="${ROOT_DIR:-$(cd "$SELF_DIR/../.." && pwd)}"

DAYS=7
CREATE_PNPM=0
CMD=""

usage() {
  sed -n '2,/^set -euo/p' "$0" | sed -E 's/^# ?//; /^set -euo/d'
}

# ---------------------------------------------------------------------------
# arg parse
# ---------------------------------------------------------------------------
if [[ $# -lt 1 ]]; then usage >&2; exit 64; fi
CMD="$1"; shift

while [[ $# -gt 0 ]]; do
  case "$1" in
    --days)         DAYS="${2:?--days requires a value}"; shift 2 ;;
    --days=*)       DAYS="${1#--days=}"; shift ;;
    --create-pnpm)  CREATE_PNPM=1; shift ;;
    -h|--help)      usage; exit 0 ;;
    *)              echo "unknown flag: $1" >&2; usage >&2; exit 64 ;;
  esac
done

if ! [[ "$DAYS" =~ ^[0-9]+$ ]] || (( DAYS < 1 )); then
  echo "error: --days must be a positive integer (got: $DAYS)" >&2
  exit 64
fi

NPMRC="$ROOT_DIR/.npmrc"
PNPM_YAML="$ROOT_DIR/pnpm-workspace.yaml"
UV_TOML="$ROOT_DIR/uv.toml"

MINUTES=$(( DAYS * 24 * 60 ))
UV_VAL="$DAYS days"

# ---------------------------------------------------------------------------
# helpers — idempotent line upsert / removal
# ---------------------------------------------------------------------------

# Upsert a `key=value` line in a flat ini-ish file (npmrc).
upsert_npmrc() {
  local file="$1" key="$2" value="$3"
  if [[ ! -f "$file" ]]; then
    printf '%s=%s\n' "$key" "$value" > "$file"
    return
  fi
  if grep -qE "^${key}=" "$file"; then
    # macOS sed needs '' after -i
    sed -i.bak -E "s|^${key}=.*|${key}=${value}|" "$file" && rm -f "$file.bak"
  else
    # ensure trailing newline before append
    if [[ -s "$file" ]] && [[ "$(tail -c1 "$file")" != $'\n' ]]; then printf '\n' >> "$file"; fi
    printf '%s=%s\n' "$key" "$value" >> "$file"
  fi
}

remove_npmrc_key() {
  local file="$1" key="$2"
  [[ -f "$file" ]] || return 0
  sed -i.bak -E "/^${key}=/d" "$file" && rm -f "$file.bak"
  # delete file if now empty (only whitespace)
  if [[ ! -s "$file" ]] || ! grep -qE '\S' "$file"; then
    rm -f "$file"
  fi
}

# Upsert a top-level `key: value` line in a YAML file.
upsert_yaml() {
  local file="$1" key="$2" value="$3"
  if [[ ! -f "$file" ]]; then
    printf '%s: %s\n' "$key" "$value" > "$file"
    return
  fi
  if grep -qE "^${key}:" "$file"; then
    sed -i.bak -E "s|^${key}:.*|${key}: ${value}|" "$file" && rm -f "$file.bak"
  else
    if [[ -s "$file" ]] && [[ "$(tail -c1 "$file")" != $'\n' ]]; then printf '\n' >> "$file"; fi
    printf '%s: %s\n' "$key" "$value" >> "$file"
  fi
}

remove_yaml_key() {
  local file="$1" key="$2"
  [[ -f "$file" ]] || return 0
  sed -i.bak -E "/^${key}:/d" "$file" && rm -f "$file.bak"
  # drop the file if it's now empty / whitespace-only
  if [[ ! -s "$file" ]] || ! grep -qE '\S' "$file"; then
    rm -f "$file"
  fi
}

# Upsert a top-level `key = "value"` line in a TOML file (uv.toml).
# Naive parser: only handles the top-level scope before the first `[section]`.
upsert_uv_toml() {
  local file="$1" key="$2" value="$3"
  if [[ ! -f "$file" ]]; then
    printf '%s = "%s"\n' "$key" "$value" > "$file"
    return
  fi
  if grep -qE "^${key}[[:space:]]*=" "$file"; then
    sed -i.bak -E "s|^${key}[[:space:]]*=.*|${key} = \"${value}\"|" "$file" && rm -f "$file.bak"
  else
    if [[ -s "$file" ]] && [[ "$(tail -c1 "$file")" != $'\n' ]]; then printf '\n' >> "$file"; fi
    printf '%s = "%s"\n' "$key" "$value" >> "$file"
  fi
}

remove_uv_toml_key() {
  local file="$1" key="$2"
  [[ -f "$file" ]] || return 0
  sed -i.bak -E "/^${key}[[:space:]]*=/d" "$file" && rm -f "$file.bak"
}

# ---------------------------------------------------------------------------
# read helpers — for `status`
# ---------------------------------------------------------------------------

read_npmrc_value() {
  [[ -f "$NPMRC" ]] || { echo ""; return; }
  { grep -E '^min-release-age=' "$NPMRC" || true; } | tail -n1 | sed -E 's|^min-release-age=||'
}

read_pnpm_value() {
  [[ -f "$PNPM_YAML" ]] || { echo ""; return; }
  { grep -E '^minimumReleaseAge:' "$PNPM_YAML" || true; } | tail -n1 | sed -E 's|^minimumReleaseAge:[[:space:]]*||'
}

read_uv_value() {
  [[ -f "$UV_TOML" ]] || { echo ""; return; }
  { grep -E '^exclude-newer[[:space:]]*=' "$UV_TOML" || true; } | tail -n1 | sed -E 's|^exclude-newer[[:space:]]*=[[:space:]]*"?([^"]*)"?|\1|'
}

# ---------------------------------------------------------------------------
# commands
# ---------------------------------------------------------------------------

cmd_apply() {
  echo "==> applying min-release-age cooldown of ${DAYS} day(s), repo-local"
  echo

  # npm
  upsert_npmrc "$NPMRC" "min-release-age" "$DAYS"
  echo "  [npm]  ${NPMRC#$ROOT_DIR/}  →  min-release-age=${DAYS}"

  # pnpm — only touch if the file already exists, unless --create-pnpm
  if [[ -f "$PNPM_YAML" ]]; then
    upsert_yaml "$PNPM_YAML" "minimumReleaseAge" "$MINUTES"
    echo "  [pnpm] ${PNPM_YAML#$ROOT_DIR/}  →  minimumReleaseAge: ${MINUTES}  (${DAYS} days)"
  elif (( CREATE_PNPM )); then
    upsert_yaml "$PNPM_YAML" "minimumReleaseAge" "$MINUTES"
    echo "  [pnpm] ${PNPM_YAML#$ROOT_DIR/}  →  created with minimumReleaseAge: ${MINUTES}"
  else
    echo "  [pnpm] ${PNPM_YAML#$ROOT_DIR/}  →  SKIPPED (no pnpm-workspace.yaml; pass --create-pnpm to force)"
  fi

  # uv
  upsert_uv_toml "$UV_TOML" "exclude-newer" "$UV_VAL"
  echo "  [uv]   ${UV_TOML#$ROOT_DIR/}  →  exclude-newer = \"${UV_VAL}\""

  echo
  echo "==> done. run \`$(basename "$0") status\` to verify."
  echo
  print_unsupported_note
}

cmd_remove() {
  echo "==> removing min-release-age cooldown from repo-local configs"
  echo

  remove_npmrc_key "$NPMRC" "min-release-age"
  echo "  [npm]  ${NPMRC#$ROOT_DIR/}  →  removed min-release-age"

  if [[ -f "$PNPM_YAML" ]]; then
    remove_yaml_key "$PNPM_YAML" "minimumReleaseAge"
    echo "  [pnpm] ${PNPM_YAML#$ROOT_DIR/}  →  removed minimumReleaseAge"
  else
    echo "  [pnpm] ${PNPM_YAML#$ROOT_DIR/}  →  not present (nothing to remove)"
  fi

  remove_uv_toml_key "$UV_TOML" "exclude-newer"
  echo "  [uv]   ${UV_TOML#$ROOT_DIR/}  →  removed exclude-newer"

  echo
  echo "==> done."
}

cmd_status() {
  local npm_v pnpm_v uv_v
  npm_v="$(read_npmrc_value)"
  pnpm_v="$(read_pnpm_value)"
  uv_v="$(read_uv_value)"

  echo "==> min-release-age status (repo-local: ${ROOT_DIR})"
  echo
  printf '  %-6s %-30s %s\n' "tool" "file" "value"
  printf '  %-6s %-30s %s\n' "----" "----" "-----"
  printf '  %-6s %-30s %s\n' "npm"  ".npmrc"               "${npm_v:-<unset>}"
  printf '  %-6s %-30s %s\n' "pnpm" "pnpm-workspace.yaml"  "${pnpm_v:-<unset>}"
  printf '  %-6s %-30s %s\n' "uv"   "uv.toml"              "${uv_v:-<unset>}"
  echo
  print_unsupported_note
}

print_unsupported_note() {
  cat <<'NOTE'
note: pip / pipx / poetry have no native release-age config.

  pip    : per-call flag,  pip install -r requirements.txt --uploaded-prior-to=<ISO8601>
           (pip >=26.1 also accepts ISO 8601 durations, e.g. --uploaded-prior-to=P7D)
  pipx   : pass through,    pipx install <pkg> --pip-args="--uploaded-prior-to=<ISO8601>"
  poetry : no native flag — gate upgrades via Renovate / Dependabot:
             renovate.json     →  "minimumReleaseAge": "7 days"
             dependabot.yml    →  cooldown: { default-days: 7 }
NOTE
}

# ---------------------------------------------------------------------------
# dispatch
# ---------------------------------------------------------------------------
case "$CMD" in
  apply)   cmd_apply ;;
  remove)  cmd_remove ;;
  status)  cmd_status ;;
  -h|--help|help) usage; exit 0 ;;
  *) echo "unknown command: $CMD" >&2; usage >&2; exit 64 ;;
esac
