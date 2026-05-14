#!/usr/bin/env bash
# CLI: fetch the authenticated Figma user.
#
# Usage:
#   FIGMA_PASS=$YOUR_TOKEN ./examples/cli/01_whoami.sh
set -euo pipefail

: "${FIGMA_PASS:?Set FIGMA_PASS to a Figma Personal Access Token}"

exec python -m examples.sdk.basic_usage
