#!/usr/bin/env bash
# Shared logging helpers for orchestrator scripts.
# Human-readable goes to stderr; JSON-line goes to stdout.
# shellcheck disable=SC2148

if [[ -t 2 ]]; then
  __ORCH_C_RED='\033[31m'
  __ORCH_C_YEL='\033[33m'
  __ORCH_C_GRN='\033[32m'
  __ORCH_C_DIM='\033[2m'
  __ORCH_C_OFF='\033[0m'
else
  __ORCH_C_RED=''
  __ORCH_C_YEL=''
  __ORCH_C_GRN=''
  __ORCH_C_DIM=''
  __ORCH_C_OFF=''
fi

log::info()  { printf '%b[orch %s]%b %s\n' "$__ORCH_C_DIM" "$(date +%H:%M:%S)" "$__ORCH_C_OFF" "$*" >&2; }
log::ok()    { printf '%b✓%b %s\n' "$__ORCH_C_GRN" "$__ORCH_C_OFF" "$*" >&2; }
log::warn()  { printf '%bWARN%b %s\n' "$__ORCH_C_YEL" "$__ORCH_C_OFF" "$*" >&2; }
log::err()   { printf '%bERROR%b %s\n' "$__ORCH_C_RED" "$__ORCH_C_OFF" "$*" >&2; }

# Emit a JSON line to stdout. Argument must already be valid JSON.
log::json()  { printf '%s\n' "$1"; }
