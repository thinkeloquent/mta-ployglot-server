#!/usr/bin/env bash
# doctor.sh — symlink topology + git config + main-shell-emptiness diagnostics.
#
# Catches the symlink-portability failures the plan calls out: Windows symlink
# privilege gaps, Git's `core.symlinks=false` default, absolute-vs-relative
# link drift, orphans, and "main is meant to be an orchestration shell"
# size-creep regressions.
#
# Each check is a function `check__<area>__<name>` that emits a TSV record:
#   <name>\t<severity>\t<ok:0|1>\t<message>\t<fix_hint>
# Severity ∈ {error, warn, info}. Auto-fixers, when available, are functions
# `fix__<area>__<name>` (the dotted check name with dots → __).
#
# Exit codes:
#   0   all `error`-severity checks passed
#   n>0 n `error`-severity checks failed
#   64  unknown flag (EX_USAGE)
set -euo pipefail
IFS=$'\n\t'

SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Honor an externally-supplied ROOT_DIR (lets tests + bootstrap fixtures
# point at a non-orchestration-shell tree). Default to walking up from the
# script's own location.
ROOT_DIR="${ROOT_DIR:-$(cd "$SELF_DIR/../.." && pwd)}"
export ROOT_DIR  # checks read it

# Capture original args so --fix can re-exec the same invocation without --fix.
ORIG_ARGS=("$@")

JSON=0
FIX=0
VERBOSE=0

usage() {
  cat <<'USAGE'
doctor.sh — workspace topology diagnostics

USAGE:
  doctor.sh [--json] [--fix] [--verbose] [-h|--help]

FLAGS:
  --json       emit one JSON object per check on stdout
  --fix        run any registered auto-fixers for failing checks, then re-run
  --verbose    show passing checks too (default hides info-severity passes)

EXIT:
  0       all error-severity checks passed
  n > 0   n error-severity checks failed
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --json)        JSON=1;    shift ;;
    --fix)         FIX=1;     shift ;;
    --verbose|-v)  VERBOSE=1; shift ;;
    -h|--help)     usage; exit 0 ;;
    *) echo "unknown flag: $1" >&2; usage >&2; exit 64 ;;
  esac
done

# Source the check registry. doctor-checks.sh defines all check__* + fix__*
# functions and SHOULD NOT have side effects on import.
# shellcheck source=doctor-checks.sh
source "$SELF_DIR/doctor-checks.sh"

# Discover and run every check. Capture each TSV record into RECORDS.
RECORDS=()
fail_count=0

for fn in $(compgen -A function check__ 2>/dev/null); do
  if rec="$($fn 2>/dev/null)"; then
    :
  else
    rec=$(printf '%s\terror\t0\tcheck threw\tnone' "$fn")
  fi
  RECORDS+=("$rec")
  IFS=$'\t' read -r name sev ok msg fix <<<"$rec"
  if [[ "$sev" == "error" && "$ok" -eq 0 ]]; then
    fail_count=$((fail_count + 1))
  fi
done

# --fix dispatch: for every failing check that has a fix__<dotted-name>
# function (with dots → __), call it. Then re-exec ourselves without --fix
# to verify the fix landed.
if [[ "$FIX" == "1" ]]; then
  applied=0
  for r in ${RECORDS[@]+"${RECORDS[@]}"}; do
    IFS=$'\t' read -r name sev ok msg fix <<<"$r"
    [[ "$ok" -eq 1 ]] && continue
    fix_fn="fix__${name//./__}"
    if declare -F "$fix_fn" >/dev/null; then
      echo "applying fix: $fix_fn ($name)"
      "$fix_fn"
      applied=$((applied + 1))
    else
      echo "no auto-fix for $name (manual: $fix)"
    fi
  done
  echo "fix mode: $applied auto-fixer(s) applied; re-running checks…"
  # Re-exec without --fix. Drop --fix from ORIG_ARGS.
  reexec=()
  for a in ${ORIG_ARGS[@]+"${ORIG_ARGS[@]}"}; do
    [[ "$a" == "--fix" ]] && continue
    reexec+=("$a")
  done
  exec "$0" ${reexec[@]+"${reexec[@]}"}
fi

# Render output.
if [[ "$JSON" == "1" ]]; then
  for r in ${RECORDS[@]+"${RECORDS[@]}"}; do
    IFS=$'\t' read -r name sev ok msg fix <<<"$r"
    printf '{"name":"%s","severity":"%s","ok":%s,"message":"%s","fix":"%s"}\n' \
      "$name" "$sev" "$ok" "$msg" "$fix"
  done
else
  for r in ${RECORDS[@]+"${RECORDS[@]}"}; do
    IFS=$'\t' read -r name sev ok msg fix <<<"$r"
    if [[ "$ok" -eq 1 && "$VERBOSE" -eq 0 ]]; then continue; fi
    printf "[%s] %s — %s\n" "$sev" "$name" "$msg"
    if [[ -n "$fix" && "$fix" != "none" ]]; then
      printf "  → fix: %s\n" "$fix"
    fi
  done
fi

exit "$fail_count"
