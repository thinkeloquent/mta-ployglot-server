#!/usr/bin/env bash
# CLI: fetch the authenticated Figma user.
#
# Usage:
#   FIGMA_PASS=$YOUR_TOKEN ./examples/cli/01-whoami.sh
#
# Optional:
#   HTTPS_PROXY=http://proxy.corp:3128
set -euo pipefail

: "${FIGMA_PASS:?Set FIGMA_PASS to a Figma Personal Access Token}"

exec npx tsx examples/sdk/01-basic-usage.ts
