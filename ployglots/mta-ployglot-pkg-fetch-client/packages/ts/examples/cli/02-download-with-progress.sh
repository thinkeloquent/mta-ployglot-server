#!/usr/bin/env bash
# Example: `CLIContext.download(url, { output, onProgress })`.
#
# Streams the response body to disk and reports cumulative bytes per chunk via
# the optional `onProgress` callback. Returns a `DownloadResult` with a POSIX
# exit code derived from the response status (`0` on 2xx, `4` on 4xx, `5` on 5xx,
# `1` on network errors).

set -euo pipefail

OUT="${1:-/tmp/posts.json}"

node --input-type=module <<EOF
import { CLIContext } from '@polyglot/fetch-http-client/sdk';

const cli = new CLIContext();
try {
  const result = await cli.download(
    'https://jsonplaceholder.typicode.com/posts',
    {
      output: '$OUT',
      onProgress: (bytes, total) => {
        const pct = total ? Math.round((bytes / total) * 100) : null;
        process.stderr.write(\`downloaded \${bytes} bytes\${pct !== null ? \` (\${pct}%)\` : ''}\\n\`);
      },
    },
  );
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.exitCode);
} finally {
  await cli.close();
}
EOF
