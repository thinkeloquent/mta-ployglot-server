// @ts-nocheck
/**
 * Example: fetch through an outbound proxy.
 *
 * Three proxy-configuration modes, all using the same `proxy = {}`
 * contract:
 *
 *   1. Auto-detect         — `proxy: {}` reads HTTPS_PROXY / HTTP_PROXY.
 *   2. Explicit host only  — `proxy: { host: 'http://p:3128' }`.
 *   3. Full override       — `proxy: { host, user, pass }`.
 *
 * Env:
 *   FIGMA_PASS       required
 *   HTTPS_PROXY      optional (consumed by mode 1)
 *   HTTP_PROXY_USER  optional (mode 1 / 3)
 *   HTTP_PROXY_PASS  optional (mode 1 / 3)
 *
 * Run:
 *   FIGMA_PASS=$YOUR_TOKEN HTTPS_PROXY=http://proxy.corp:3128 \
 *     npx tsx examples/sdk/02-with-proxy.ts
 */

import { FigmaClient } from '@polyglot/figma-api';

async function main(): Promise<void> {
  const mode = (process.argv[2] ?? 'auto').toLowerCase();

  let client: FigmaClient;
  if (mode === 'explicit') {
    client = new FigmaClient({ proxy: { host: process.env.HTTPS_PROXY ?? '' } });
  } else if (mode === 'full') {
    client = new FigmaClient({
      proxy: {
        host: process.env.HTTPS_PROXY ?? '',
        user: process.env.HTTP_PROXY_USER ?? '',
        pass: process.env.HTTP_PROXY_PASS ?? '',
      },
    });
  } else {
    // mode === 'auto'
    client = new FigmaClient({ proxy: {} });
  }

  try {
    const me = await client.me.get();
    process.stdout.write(`Figma [${mode}] → @${me.handle}\n`);
  } finally {
    await client.close();
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`Example failed: ${(err as Error).message}\n`);
  process.exitCode = 1;
});
