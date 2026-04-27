#!/usr/bin/env bash
# Iterate every sibling in the registry; run a command in each sibling's local_path.
# Output convention: human → stderr, JSON-line → stdout when --json.
#
# Usage:
#   _for-each-sibling.sh --cmd '<shell command>' [--language node|python|mixed|all] \
#                        [--mode parallel|serial] [--keep-going] [--json] \
#                        [--no-skip-not-hydrated]

set -euo pipefail
IFS=$'\n\t'

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/log.sh
source "$HERE/lib/log.sh"
# shellcheck source=lib/registry.sh
source "$HERE/lib/registry.sh"

CMD=""
LANG=all
MODE=serial
KEEP_GOING=0
JSON=0
SKIP_NOT_HYDRATED=1
SIBLINGS_FILTER=""
MAX_PARALLEL="${ORCH_MAX_PARALLEL:-4}"

usage() {
  cat <<'EOF' >&2
usage: _for-each-sibling.sh --cmd '<command>' [options]
  --cmd '<command>'     shell command to run in each sibling (required)
  --language <lang>     node|python|mixed|go|rust|all (default: all)
  --siblings "<list>"   space-separated subset of sibling names; intersects with --language
  --mode <mode>         parallel|serial (default: serial)
  --keep-going          continue past failures; exit code = failure count (capped at 255)
  --json                emit one JSON line per sibling result on stdout (suppress human format)
  --no-skip-not-hydrated   treat not-hydrated siblings as failures instead of skipping
EOF
  exit 64
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --cmd)                   CMD="${2:-}"; shift 2 ;;
    --language)              LANG="${2:-all}"; shift 2 ;;
    --siblings)              SIBLINGS_FILTER="${2:-}"; shift 2 ;;
    --mode)                  MODE="${2:-serial}"; shift 2 ;;
    --keep-going)            KEEP_GOING=1; shift ;;
    --json)                  JSON=1; shift ;;
    --no-skip-not-hydrated)  SKIP_NOT_HYDRATED=0; shift ;;
    -h|--help)               usage ;;
    *)                       log::err "unknown arg: $1"; usage ;;
  esac
done

[[ -n "$CMD" ]] || { log::err "--cmd required"; usage; }

emit_record() {
  # Build a JSON record; emit JSON to stdout if --json, human to stderr otherwise.
  local name="$1" status="$2" exit_code="$3" duration_ms="$4" reason="${5:-}"
  if [[ "$JSON" -eq 1 ]]; then
    jq -nc --arg n "$name" --arg s "$status" --arg r "$reason" \
      --argjson e "$exit_code" --argjson d "$duration_ms" \
      '{sibling:$n, status:$s, exit_code:$e, duration_ms:$d, reason:$r}'
  else
    case "$status" in
      ok)      log::ok "$name (${duration_ms}ms)" ;;
      skipped) printf '%b- %s%b (skipped: %s)\n' "$__ORCH_C_DIM" "$name" "$__ORCH_C_OFF" "$reason" >&2 ;;
      failed)  printf '%b✗ %s%b (%sms): exit %s%s\n' "$__ORCH_C_RED" "$name" "$__ORCH_C_OFF" "$duration_ms" "$exit_code" "${reason:+ — $reason}" >&2 ;;
    esac
  fi
}

run_one() {
  local name="$1"
  local local_path; local_path=$(registry::sibling_path "$name")
  local lang;       lang=$(registry::sibling_language "$name")
  local default_ref; default_ref=$(registry::sibling_default_ref "$name")

  if [[ ! -d "$local_path" ]]; then
    if [[ "$SKIP_NOT_HYDRATED" -eq 1 ]]; then
      emit_record "$name" skipped 0 0 "not-hydrated"
      return 0
    else
      emit_record "$name" failed 1 0 "not-hydrated"
      return 1
    fi
  fi

  local start_ns end_ns dur_ms rc
  start_ns=$(date +%s%N 2>/dev/null || python3 -c 'import time; print(int(time.time()*1e9))')
  set +e
  ( cd "$local_path" \
    && SIBLING_NAME="$name" \
       SIBLING_LANGUAGE="$lang" \
       SIBLING_DEFAULT_REF="$default_ref" \
       SIBLING_LOCAL_PATH="$local_path" \
       bash -c "$CMD" )
  rc=$?
  set -e
  end_ns=$(date +%s%N 2>/dev/null || python3 -c 'import time; print(int(time.time()*1e9))')
  dur_ms=$(( (end_ns - start_ns) / 1000000 ))

  if [[ "$rc" -eq 0 ]]; then
    emit_record "$name" ok 0 "$dur_ms" ""
    return 0
  else
    emit_record "$name" failed "$rc" "$dur_ms" ""
    return "$rc"
  fi
}

# Collect sibling names, filtered by language. Use while-read to stay bash-3 compatible.
NAMES=()
while IFS= read -r __name; do
  [[ -n "$__name" ]] && NAMES+=("$__name")
done < <(registry::sibling_names_by_lang "$LANG")
[[ "${#NAMES[@]}" -gt 0 ]] || { log::err "no siblings match language=$LANG"; exit 0; }

# Apply explicit subset filter (--siblings "name1 name2"). Refuses on unknown
# names so silent typos can't widen scope to "all language-matching siblings".
if [[ -n "$SIBLINGS_FILTER" ]]; then
  # Script-wide IFS is $'\n\t', which would treat the whole space-separated
  # list as one name. Override IFS only for this read-into-array.
  REQUESTED=()
  IFS=$' \t\n' read -ra REQUESTED <<< "$SIBLINGS_FILTER"
  UNKNOWN=()
  for __req in "${REQUESTED[@]}"; do
    __found=0
    for __have in "${NAMES[@]}"; do
      [[ "$__have" == "$__req" ]] && { __found=1; break; }
    done
    [[ "$__found" -eq 0 ]] && UNKNOWN+=("$__req")
  done
  if [[ "${#UNKNOWN[@]}" -gt 0 ]]; then
    log::err "unknown sibling(s) in --siblings: ${UNKNOWN[*]}"
    log::err "known siblings (language=$LANG): ${NAMES[*]}"
    exit 64
  fi
  # Preserve registry order; intersect.
  FILTERED=()
  for __have in "${NAMES[@]}"; do
    for __req in "${REQUESTED[@]}"; do
      if [[ "$__have" == "$__req" ]]; then
        FILTERED+=("$__have")
        break
      fi
    done
  done
  NAMES=("${FILTERED[@]}")
  [[ "${#NAMES[@]}" -gt 0 ]] || { log::err "no siblings remain after --siblings filter"; exit 0; }
fi

FAILS=0
FIRST_RC=0

if [[ "$MODE" == "serial" ]]; then
  for name in "${NAMES[@]}"; do
    rc=0
    run_one "$name" || rc=$?
    if [[ "$rc" -ne 0 ]]; then
      [[ "$FIRST_RC" -eq 0 ]] && FIRST_RC="$rc"
      FAILS=$((FAILS + 1))
      [[ "$KEEP_GOING" -eq 1 ]] || break
    fi
  done
else
  # Parallel mode with bounded concurrency. Process in batches of MAX_PARALLEL —
  # simpler and more portable than `wait -n` (bash 4.3+). Output is captured per
  # sibling and drained in registry order for deterministic output.
  TMPDIR_=$(mktemp -d)
  trap 'rm -rf "$TMPDIR_"' EXIT

  total="${#NAMES[@]}"
  i=0
  while [[ "$i" -lt "$total" ]]; do
    batch_end=$(( i + MAX_PARALLEL ))
    [[ "$batch_end" -gt "$total" ]] && batch_end="$total"
    j="$i"
    while [[ "$j" -lt "$batch_end" ]]; do
      name="${NAMES[$j]}"
      {
        run_one "$name" >"$TMPDIR_/$j.out" 2>"$TMPDIR_/$j.err"
        printf '%s' "$?" >"$TMPDIR_/$j.rc"
      } &
      j=$((j + 1))
    done
    wait
    i="$batch_end"
  done

  for j in $(seq 0 $(( total - 1 ))); do
    [[ -f "$TMPDIR_/$j.err" ]] && cat "$TMPDIR_/$j.err" >&2
    [[ -f "$TMPDIR_/$j.out" ]] && cat "$TMPDIR_/$j.out"
    rc=$(cat "$TMPDIR_/$j.rc" 2>/dev/null || echo 1)
    if [[ "$rc" -ne 0 ]]; then
      [[ "$FIRST_RC" -eq 0 ]] && FIRST_RC="$rc"
      FAILS=$((FAILS + 1))
    fi
  done
fi

if [[ "$JSON" -eq 0 ]]; then
  printf '%b%d/%d siblings ok%b\n' "$__ORCH_C_DIM" "$(( ${#NAMES[@]} - FAILS ))" "${#NAMES[@]}" "$__ORCH_C_OFF" >&2
fi

if [[ "$FAILS" -eq 0 ]]; then
  exit 0
elif [[ "$KEEP_GOING" -eq 1 ]]; then
  # Cap at 255 to fit a process exit code.
  [[ "$FAILS" -gt 255 ]] && FAILS=255
  exit "$FAILS"
else
  exit "$FIRST_RC"
fi
