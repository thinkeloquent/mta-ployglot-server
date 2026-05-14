#!/usr/bin/env bash
# check-no-hardcoded-registry.sh — fail if any package config commits a literal
# registry URL.
#
# Policy: registry URLs MUST flow from Makefile.vars (or `.env` override) into
# the install process via env vars — `NPM_REGISTRY` (npm/pnpm) and
# `PYTHON_REGISTRY_URL` (which Makefile.vars fans out to `PIP_INDEX_URL`,
# `UV_INDEX_URL`, `UV_DEFAULT_INDEX`). A literal URL inside any committed
# package config is an SSOT violation: it pins one machine's registry into the
# repo, blocks contributors whose corporate registry differs, and bypasses
# Makefile.vars' conditional-export plumbing (which strips empty/sentinel
# values so unset stays unset).
#
# Files scanned:
#   pyproject.toml — section-aware: only flags `url =` lines inside
#                    [[tool.uv.index]] or [tool.poetry.source] tables.
#                    [tool.uv.sources] entries (path/git deps) are ignored.
#   uv.toml        — top-level `index-url` / `extra-index-url`, plus
#                    `url =` inside [[index]] tables.
#   .npmrc         — `registry=` and `@scope:registry=` lines.
#   pip.conf       — `index-url`, `extra-index-url`.
#   .pypirc        — `repository`, `index-url`.
#
# Allowlist — these hostnames are tolerated as literals because they ARE the
# canonical "no override" defaults:
#   registry.npmjs.org   npm public default
#   pypi.org             pip / uv public default
#   localhost:4873       Verdaccio dev-mode default (Makefile.vars NPM_REGISTRY)
#   127.0.0.1            same, IP form
#
# Local usage:
#   ./.bin/check-no-hardcoded-registry.sh
#
# Exit codes:
#   0  no hardcoded registries found
#   1  one or more hardcoded URLs detected

set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "$ROOT_DIR"

ALLOW_REGEX='registry\.npmjs\.org|pypi\.org|localhost:4873|127\.0\.0\.1'

violations=()

# --- pyproject.toml: [[tool.uv.index]] and [tool.poetry.source] tables --------
#
# Section-aware scan — track current TOML table header and only flag `url = ...`
# when we're inside one of the two registry-defining tables. [tool.uv.sources]
# (sibling path / git deps) is intentionally ignored.
scan_pyproject() {
  local f="$1"
  local in_target=0
  local lineno=0
  local line
  while IFS= read -r line || [[ -n "$line" ]]; do
    lineno=$((lineno+1))
    if [[ "$line" =~ ^[[:space:]]*\[\[?tool\.uv\.index\]\]?[[:space:]]*$ ]] \
       || [[ "$line" =~ ^[[:space:]]*\[\[?tool\.poetry\.source\]\]?[[:space:]]*$ ]]; then
      in_target=1
      continue
    fi
    if [[ "$line" =~ ^[[:space:]]*\[ ]]; then
      in_target=0
      continue
    fi
    if (( in_target )) && [[ "$line" =~ ^[[:space:]]*url[[:space:]]*= ]]; then
      if ! grep -qE "$ALLOW_REGEX" <<< "$line"; then
        violations+=("$f:$lineno: $line")
      fi
    fi
  done < "$f"
}

while IFS= read -r f; do
  scan_pyproject "$f"
done < <(find -L . -type f -name 'pyproject.toml' \
  -not -path '*/.venv/*' \
  -not -path '*/node_modules/*' \
  -not -path '*/dist/*' \
  -not -path '*/.dev/*' \
  -not -path '*/.git/*' 2>/dev/null)

# --- uv.toml: top-level index-url / extra-index-url + [[index]].url ----------
#
# We don't bother with section-awareness here — uv.toml's top-level
# `index-url` and any `url =` line in an [[index]] block are both registry
# pointers, and uv.toml carries no other `url`-keyed schemas worth confusing
# them with.
scan_simple_kv() {
  local f="$1"
  local key_regex="$2"
  local matches
  matches=$(grep -nE "$key_regex" "$f" 2>/dev/null || true)
  [[ -z "$matches" ]] && return 0
  local line
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    # Skip pure comment lines.
    [[ "$line" =~ ^[0-9]+:[[:space:]]*# ]] && continue
    if ! grep -qE "$ALLOW_REGEX" <<< "$line"; then
      violations+=("$f: $line")
    fi
  done <<< "$matches"
}

while IFS= read -r f; do
  scan_simple_kv "$f" '^[[:space:]]*(index-url|extra-index-url|url)[[:space:]]*='
done < <(find -L . -type f -name 'uv.toml' \
  -not -path '*/.venv/*' \
  -not -path '*/node_modules/*' \
  -not -path '*/.dev/*' \
  -not -path '*/.git/*' 2>/dev/null)

# --- .npmrc: registry= and @scope:registry= -----------------------------------
while IFS= read -r f; do
  scan_simple_kv "$f" '^[^#]*registry[[:space:]]*='
done < <(find -L . -type f -name '.npmrc' \
  -not -path '*/.venv/*' \
  -not -path '*/node_modules/*' \
  -not -path '*/.dev/*' \
  -not -path '*/.git/*' 2>/dev/null)

# --- pip.conf, .pypirc --------------------------------------------------------
while IFS= read -r f; do
  scan_simple_kv "$f" '^[^#]*((index|extra-index)-url|repository)[[:space:]]*='
done < <(find -L . -type f \( -name 'pip.conf' -o -name '.pypirc' \) \
  -not -path '*/.venv/*' \
  -not -path '*/node_modules/*' \
  -not -path '*/.dev/*' \
  -not -path '*/.git/*' 2>/dev/null)

# --- summary ------------------------------------------------------------------
if (( ${#violations[@]} > 0 )); then
  echo "FAIL: hardcoded registry URLs found in package configs:" >&2
  for v in "${violations[@]}"; do echo "  $v" >&2; done
  echo "" >&2
  echo "Registry URLs must come from Makefile.vars / .env at runtime," >&2
  echo "not from committed config. Set NPM_REGISTRY (npm/pnpm) and/or" >&2
  echo "PYTHON_REGISTRY_URL (fans out to PIP_INDEX_URL, UV_INDEX_URL," >&2
  echo "UV_DEFAULT_INDEX via Makefile.vars). See .env.example." >&2
  exit 1
fi

echo "pass: no hardcoded registry URLs in package configs"
