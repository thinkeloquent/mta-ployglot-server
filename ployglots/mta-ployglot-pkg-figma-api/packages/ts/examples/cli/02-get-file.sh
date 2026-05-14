#!/usr/bin/env bash
# CLI: fetch a Figma file document.
#
# Usage:
#   FIGMA_PASS=$YOUR_TOKEN ./examples/cli/02-get-file.sh <file-key>
set -euo pipefail

: "${FIGMA_PASS:?Set FIGMA_PASS to a Figma Personal Access Token}"

FILE_KEY="${1:-${FIGMA_FILE_KEY:-}}"
if [[ -z "$FILE_KEY" ]]; then
  echo "Usage: $0 <file-key>  or set FIGMA_FILE_KEY" >&2
  exit 2
fi

FIGMA_FILE_KEY="$FILE_KEY" exec npx tsx -e '
  import("@polyglot/figma-api").then(async ({ FigmaClient }) => {
    const client = new FigmaClient({ proxy: {} });
    try {
      const file = await client.files.get(process.env.FIGMA_FILE_KEY, { depth: 1 });
      process.stdout.write(JSON.stringify({ name: file.name, version: file.version, lastModified: file.lastModified }, null, 2) + "\n");
    } finally {
      await client.close();
    }
  }).catch((err) => { process.stderr.write(err.message + "\n"); process.exit(1); });
'
