#!/usr/bin/env bash
# list-poetry-packages.sh — filter a path list down to poetry-installable entries.
#
# A pyproject.toml is poetry-installable iff it declares `[tool.poetry]`
# OR names `poetry.core.masonry.api` as its build backend. Anything else
# (uv workspace roots, hatchling/setuptools projects without poetry config,
# `[tool.uv] package = false` aggregators) Poetry 2.x rejects with:
#   "Either [project.name] or [tool.poetry.name] is required in package mode"
#
# Used by Makefile.lang.python to compute $(POETRY_PKGS) — the subset of
# $(PY_PKGS) that py.install / py.ci-install can actually feed to poetry.
# Touch this script (not the Makefile) to evolve the predicate.
#
# Usage:
#   list-poetry-packages.sh <path> [<path> …]
#
# Each <path> is taken relative to $ROOT_DIR if not absolute (default $PWD).
# Qualifying paths are printed to stdout, one per line, in input order.
# Missing or non-matching paths are silently dropped — this is a filter, not
# a validator. Stderr is reserved for genuine errors (none expected).

set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$PWD}"

for raw in "$@"; do
  if [[ "$raw" = /* ]]; then
    path="$raw"
  else
    path="$ROOT_DIR/$raw"
  fi
  pyproject="$path/pyproject.toml"
  [[ -f "$pyproject" ]] || continue
  if grep -qE '^\[tool\.poetry\]|poetry\.core\.masonry\.api' "$pyproject" 2>/dev/null; then
    printf '%s\n' "$raw"
  fi
done
