#!/bin/bash

# Scan a directory (depth=1) for sub-packages with package.json
# and add each to the workspace root via `pnpm add <name> -w`.
#
# Usage:
#   .bin/pnpm-add-local-packages.sh <directory>
#   .bin/pnpm-add-local-packages.sh packages_node
#   .bin/pnpm-add-local-packages.sh --dry-run packages_node

set -euo pipefail

DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run|-n)
      DRY_RUN=true
      shift
      ;;
    -*)
      echo "Unknown option: $1" >&2
      echo "Usage: $0 [--dry-run] <directory>" >&2
      exit 1
      ;;
    *)
      break
      ;;
  esac
done

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 [--dry-run] <directory>" >&2
  exit 1
fi

TARGET_DIR="$1"

if [[ ! -d "$TARGET_DIR" ]]; then
  echo "Error: '$TARGET_DIR' is not a directory" >&2
  exit 1
fi

ADDED=0
SKIPPED=0

for dir in "$TARGET_DIR"/*/; do
  [[ -d "$dir" ]] || continue

  pkg_json="$dir/package.json"
  [[ -f "$pkg_json" ]] || continue

  # Extract "name" field from package.json
  pkg_name=$(node -e "process.stdout.write(require('./$pkg_json').name || '')" 2>/dev/null)

  if [[ -z "$pkg_name" ]]; then
    echo "SKIP  $dir (no \"name\" in package.json)"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  pkg_path="./${dir%/}"

  if [[ "$DRY_RUN" == true ]]; then
    echo "DRY   pnpm add $pkg_path -w  ($pkg_name)"
  else
    echo "ADD   $pkg_name  ($pkg_path)"
    pnpm add "$pkg_path" -w
  fi
  ADDED=$((ADDED + 1))
done

echo ""
if [[ "$DRY_RUN" == true ]]; then
  echo "Dry run: $ADDED package(s) would be added, $SKIPPED skipped"
else
  echo "Done: $ADDED package(s) added, $SKIPPED skipped"
fi
