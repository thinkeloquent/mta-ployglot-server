#!/usr/bin/env bash
# secret-scan-ghe.sh — query GitHub (Enterprise) Secret Scanning alerts via the
# REST API instead of running a local scanner. The repo's GHAS-side scan is
# the source of truth; this script just reads it.
#
# Auth (either, GH_TOKEN_SECSCAN wins — same precedence as the `gh` CLI):
#   GH_TOKEN_SECSCAN      — preferred name. PAT or fine-grained token with
#                           `secret_scanning_alerts: read` on the target repo.
#   GITHUB_TOKEN_SECSCAN  — accepted alias.
#                           In CI: set via env from a repo/org secret.
#
# Endpoint resolution:
#   GITHUB_API_URL        — optional. GitHub Actions sets this automatically:
#                           - dotcom:    https://api.github.com
#                           - GHE Server: https://<host>/api/v3
#                           Defaults to https://api.github.com when unset.
#
# Owner/repo derivation:
#   Read from `git config --get remote.origin.url`. Supports both
#   git@host:owner/repo[.git] and https://host/owner/repo[.git] forms.
#
# Modes:
#   (no flag)  — pretty output; exit 1 if any open alerts
#   --json     — JSON-lines: one object per open alert
#   --check    — same as default; provided for symmetry with other gate scripts
#
# Exit codes:
#   0  — no open alerts
#   1  — open alerts present
#   2  — API / config error (missing token, non-200, malformed remote)

set -euo pipefail

MODE=pretty
case "${1:-}" in
  --json)  MODE=json  ;;
  --check) MODE=pretty ;;
  "")      ;;
  *)       echo "usage: $(basename "$0") [--json|--check]" >&2; exit 64 ;;
esac

TOKEN="${GH_TOKEN_SECSCAN:-${GITHUB_TOKEN_SECSCAN:-}}"
if [[ -z "$TOKEN" ]]; then
  echo "ERROR: neither GH_TOKEN_SECSCAN nor GITHUB_TOKEN_SECSCAN is set" >&2
  echo "  → provision a PAT or fine-grained token with secret_scanning_alerts:read" >&2
  echo "  → in CI: pass via env from a repo/org secret of either name" >&2
  exit 2
fi

API_BASE="${GITHUB_API_URL:-https://api.github.com}"

REMOTE_URL=$(git config --get remote.origin.url 2>/dev/null || true)
if [[ -z "$REMOTE_URL" ]]; then
  echo "ERROR: no origin remote configured; cannot derive owner/repo" >&2
  exit 2
fi
# Strip git@host: or https://host/ prefix and trailing .git
REPO_PATH=$(echo "$REMOTE_URL" | sed -E 's#^(https?://[^/]+/|git@[^:]+:)##; s#\.git$##')
if [[ "$REPO_PATH" != */* ]]; then
  echo "ERROR: could not parse owner/repo from remote URL: $REMOTE_URL" >&2
  exit 2
fi

resp=$(curl -sS -w '\n%{http_code}' \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "${API_BASE}/repos/${REPO_PATH}/secret-scanning/alerts?state=open&per_page=100")
http_code=$(echo "$resp" | tail -1)
body=$(echo "$resp" | sed '$d')

if [[ "$http_code" -ne 200 ]]; then
  echo "ERROR: ${API_BASE}/repos/${REPO_PATH}/secret-scanning/alerts returned HTTP ${http_code}" >&2
  echo "$body" | head -5 >&2
  exit 2
fi

count=$(echo "$body" | jq 'length')

if [[ "$MODE" == "json" ]]; then
  echo "$body" | jq -c '.[] | {number, state, secret_type, secret_type_display_name, html_url, created_at}'
  exit 0
fi

if [[ "$count" -eq 0 ]]; then
  echo "secret-scan: OK (0 open alerts in ${REPO_PATH})"
  exit 0
fi

echo "secret-scan: FAILED — ${count} open alert(s) in ${REPO_PATH}"
echo "$body" | jq -r '.[] | "  #\(.number) \(.secret_type_display_name // .secret_type) \(.html_url)"'
exit 1
