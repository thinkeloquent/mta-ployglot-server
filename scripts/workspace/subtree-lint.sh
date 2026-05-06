#!/usr/bin/env bash
# subtree-lint.sh — refuse `git subtree (add|pull|merge)` without --squash.
#
# This is the single most load-bearing guard in the workspace toolkit. Without
# --squash, `git subtree` records the entire history of the merged subtree as
# real commits in the orchestration repo, which inflates .git/ unboundedly
# across releases. The lint runs as a prerequisite of `make ci` so every CI
# build catches a regression.
#
# Scope: tracked files matching Makefile*, scripts/workspace/**, and
# .github/workflows/**.
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
cd "$ROOT_DIR"

# Targeted glob: Makefiles + workspace scripts + GH workflows. Unmatched
# globs are silently dropped (some directories may not exist yet).
mapfile_compat() {
  # bash 3.2-compatible array fill from stdin.
  local _arr_name="$1"
  shift
  eval "$_arr_name=()"
  local _line
  while IFS= read -r _line; do
    [[ -z "$_line" ]] && continue
    eval "$_arr_name+=(\"\$_line\")"
  done
}

FILES=()
mapfile_compat FILES < <(git ls-files \
    'Makefile*' \
    'scripts/workspace/*.sh' \
    'scripts/workspace/**/*.sh' \
    '.github/workflows/*.yml' \
    '.github/workflows/*.yaml' \
    2>/dev/null || true)

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "ok: no candidate files to lint"
  exit 0
fi

bad=0
for f in "${FILES[@]}"; do
  # Skip this lint script itself — it deliberately mentions the verbs in
  # comments + grep patterns. Same for the example doc if tracked.
  case "$f" in
    scripts/workspace/subtree-lint.sh) continue ;;
  esac

  # Find any line that calls `git subtree add|pull|merge` without --squash.
  # Three-stage filter:
  #   1. Match the verb pattern (git + subtree + add/pull/merge).
  #   2. Drop lines that have --squash on the same line.
  #   3. Drop lines that look like comments — leading whitespace then #
  #      (sh/yaml/Makefile) or // (C-family). Comments mention the verb in
  #      prose ("FAIL: git subtree add failed" error strings, exit-code
  #      tables, etc.) without invoking it.
  if violations="$(grep -nE 'git[[:space:]]+subtree[[:space:]]+(add|pull|merge)\b' "$f" 2>/dev/null \
                   | grep -v -- '--squash' \
                   | grep -vE '^[0-9]+:[[:space:]]*(#|//)' \
                   || true)"; then
    if [[ -n "$violations" ]]; then
      echo "FAIL: $f contains git subtree without --squash:" >&2
      printf '  %s\n' "$violations" >&2
      bad=1
    fi
  fi
done

if [[ "$bad" -eq 0 ]]; then
  echo "ok: all git subtree invocations include --squash (${#FILES[@]} files scanned)"
fi
exit "$bad"
