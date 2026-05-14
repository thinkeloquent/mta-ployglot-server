#!/usr/bin/env bash
# addon-lint.sh — enforce numeric prefix discipline under
# server/{fastify,fastapi}/config/{environment,lifecycles,routes}/.
#
# Allowed ranges per directory (matches actual repo convention):
#   environment/  → 01-09     (defaults phase)
#   lifecycles/   → 10-29     (early/late lifecycle hooks)
#   routes/       → 10-99     (10=early like healthz, 30=normal, 99=wildcard)
#
# DEVIATION FROM PLAN: the plan's routes range was 30-49 and included a
# collision check. Reality: routes/ contains 10_healthz, multiple 30_*, and
# 99_wildcard — so range is widened to 10-99 and collision check is dropped
# (multiple 30_*.routes.* is the intended grouping convention).
#
# Files starting with `_` (private helpers like _fetch_factories.py) are exempt.
#
# Findings:
#   missing      — file has no leading NN_
#   non-numeric  — leading prefix is not digits
#   out-of-range — numeric prefix is outside the directory's allowed range
#
# Usage:
#   addon-lint.sh [--json]

set -euo pipefail

JSON=0
[[ "${1:-}" == "--json" ]] && JSON=1

emit_human() { printf '%s %s: %s\n' "$1" "$2" "$3"; }
emit_json()  { jq -nc --arg kind "$1" --arg file "$2" --arg detail "$3" \
                 '{kind:$kind, file:$file, detail:$detail}'; }
emit() {
  if [[ "$JSON" -eq 1 ]]; then emit_json "$@"; else emit_human "$@"; fi
}

range_for() {
  case "$1" in
    environment) echo "1 9" ;;
    lifecycles)  echo "10 29" ;;
    routes)      echo "10 99" ;;
    *)           echo "" ;;
  esac
}

FAIL=0

for twin in fastify fastapi; do
  for sub in environment lifecycles routes; do
    dir="server/$twin/config/$sub"
    [[ -d "$dir" ]] || continue
    range=$(range_for "$sub")
    lo=$(echo "$range" | cut -d' ' -f1)
    hi=$(echo "$range" | cut -d' ' -f2)

    while IFS= read -r f; do
      [[ -z "$f" ]] && continue
      base=$(basename "$f")
      # Exempt: files starting with `_`
      [[ "$base" == _* ]] && continue

      # Extract leading prefix before first `_`
      prefix=$(echo "$base" | sed -nE 's/^([0-9]+)_.*/\1/p')

      if [[ -z "$prefix" ]]; then
        # Either no `_` at all, or prefix not numeric
        if [[ "$base" != *_* ]]; then
          emit "missing" "$f" "no NN_ prefix"
        else
          actual=$(echo "$base" | cut -d_ -f1)
          emit "non-numeric" "$f" "prefix '$actual' is not numeric"
        fi
        FAIL=$((FAIL + 1))
        continue
      fi

      # Strip leading zeros for arithmetic comparison
      n=$((10#$prefix))
      if [[ "$n" -lt "$lo" || "$n" -gt "$hi" ]]; then
        emit "out-of-range" "$f" "prefix $prefix not in ${lo}-${hi}"
        FAIL=$((FAIL + 1))
      fi
    done < <(find "$dir" -maxdepth 1 -type f \( -name '*.mjs' -o -name '*.js' -o -name '*.py' \) | sort)
  done
done

if [[ "$JSON" -eq 0 && "$FAIL" -eq 0 ]]; then
  echo "addon-lint: OK (no findings)"
fi

exit "$FAIL"
