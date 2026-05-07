#!/usr/bin/env bash
# release-preflight.sh — gate the release workflow before history is flattened.
#
# Runs in `.github/workflows/release.yml` between subtree-assemble and the
# orphan-collapse step. The orphan collapse is destructive (rewrites
# release/<X> to a parent-less single commit and force-pushes), so any defect
# detected after that point requires a full re-run. Catch them here.
#
# Gates (each prints `pass:` / `FAIL:` and exits non-zero on the first FAIL):
#
#   1. License format
#      Scan every ployglots/**/pyproject.toml for the legacy PEP 621
#      table-form `license = { text = ... }` / `license = { file = ... }`.
#      Poetry 2.2+ rejects these; they must be the PEP 639 SPDX string form
#      (`license = "MIT"`). One bad entry breaks `poetry lock` for everyone.
#
#   2. TOML well-formedness
#      Every ployglots/**/pyproject.toml must parse as valid TOML. Catches
#      typos and merge-conflict markers that slip past `git subtree add`.
#
#   3. Bootstrap re-emit
#      Run `scripts/workspace/bootstrap.sh --re-emit-only` against the
#      assembled tree. Validates that the emitter chain (Makefile.entries,
#      pnpm-workspace.yaml, go.work, Cargo.toml, .dev/workspace.toml.lock.json,
#      docker-compose.yml) regenerates cleanly with ployglots/<name> as real
#      directories — the topology that `make bootstrap` will see on a fresh
#      release/<X> clone.
#
# Local usage:
#   ./scripts/workspace/release-preflight.sh
#
# Exit codes:
#   0   all gates pass
#   1   one or more gates failed
#   127 missing dependency (python3, bash)

set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
cd "$ROOT_DIR"

failed=0

# --- gate 1: license format ----------------------------------------------------

bad_license=$(grep -rln --include='pyproject.toml' \
  -E '^[[:space:]]*license[[:space:]]*=[[:space:]]*\{' ployglots/ 2>/dev/null || true)
if [[ -n "$bad_license" ]]; then
  echo "FAIL: PEP 621 table-form license declarations found (Poetry 2.x rejects these):" >&2
  echo "$bad_license" | sed 's/^/  /' >&2
  echo "  fix: replace 'license = { text = \"MIT\" }' with 'license = \"MIT\"'" >&2
  failed=1
else
  echo "pass: gate 1 — license format (PEP 639 SPDX strings only)"
fi

# --- gate 2: TOML well-formedness ---------------------------------------------

bad_toml=()
while IFS= read -r f; do
  if ! python3 -c 'import sys, tomllib; tomllib.load(open(sys.argv[1], "rb"))' "$f" 2>/dev/null; then
    bad_toml+=("$f")
  fi
done < <(find ployglots -name pyproject.toml -type f 2>/dev/null)

if (( ${#bad_toml[@]} > 0 )); then
  echo "FAIL: pyproject.toml files failed to parse as TOML:" >&2
  for f in "${bad_toml[@]}"; do echo "  $f" >&2; done
  failed=1
else
  echo "pass: gate 2 — every ployglots/**/pyproject.toml parses as TOML"
fi

# --- gate 3: bootstrap re-emit -------------------------------------------------

if ! bash "$ROOT_DIR/scripts/workspace/bootstrap.sh" --re-emit-only >/tmp/release-preflight-bootstrap.log 2>&1; then
  echo "FAIL: bootstrap.sh --re-emit-only exited non-zero on the assembled tree" >&2
  echo "---- bootstrap.sh output ----" >&2
  cat /tmp/release-preflight-bootstrap.log >&2
  echo "-----------------------------" >&2
  failed=1
else
  echo "pass: gate 3 — bootstrap.sh --re-emit-only against assembled tree"
fi

# --- summary -------------------------------------------------------------------

if (( failed )); then
  echo "FAIL: release-preflight refusing to flatten history with one or more gate failures" >&2
  exit 1
fi
echo "pass: release-preflight — all gates clear"
