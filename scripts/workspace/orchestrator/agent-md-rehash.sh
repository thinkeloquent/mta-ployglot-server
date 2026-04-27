#!/usr/bin/env bash
# agent-md-rehash.sh — refresh the embedded surface-hash markers in every
# .agent.md after intentionally regenerating .agent.md content.
#
# Thin wrapper around agent-md-check.sh --migrate.

set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$HERE/agent-md-check.sh" --migrate "$@"
