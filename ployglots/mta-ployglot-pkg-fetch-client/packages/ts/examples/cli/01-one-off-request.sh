#!/usr/bin/env bash
# Example: `CLIContext` via a tiny Node wrapper.
#
# The package does not ship a standalone `bin` in this scaffold; this snippet
# shows the expected UX when wiring the CLI into a user-controlled binary. The
# CLIContext follows redirects by default and exposes `.download()` for piping
# response bodies straight to disk with a progress callback.

set -euo pipefail

node --input-type=module <<'EOF'
import { CLIContext } from '@polyglot/fetch-http-client/sdk';

const cli = new CLIContext();
try {
  const resp = await cli.request('GET', 'https://jsonplaceholder.typicode.com/posts/1');
  console.log('status:', resp.statusCode);
  console.log('body:', await resp.text());
} finally {
  await cli.close();
}
EOF
