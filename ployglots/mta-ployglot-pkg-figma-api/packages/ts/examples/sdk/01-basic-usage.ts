// @ts-nocheck
/**
 * Example: basic SDK usage — fetch the authenticated user.
 *
 * Env:
 *   FIGMA_HOST   — optional override (default https://api.figma.com)
 *   FIGMA_USER   — optional placeholder (Figma is token-only)
 *   FIGMA_PASS   — required Figma Personal Access Token
 *   HTTPS_PROXY  — optional outbound proxy
 *
 * Run:
 *   FIGMA_PASS=$YOUR_TOKEN npx tsx examples/sdk/01-basic-usage.ts
 */

import { FigmaClient } from '@polyglot/figma-api';

async function main(): Promise<void> {
  // `proxy: {}` = auto-detect from HTTPS_PROXY / HTTP_PROXY.
  // `token` falls back to env FIGMA_PASS if not supplied explicitly.
  const client = new FigmaClient({ proxy: {} });

  try {
    const me = await client.me.get();
    process.stdout.write(`Figma → @${me.handle} <${me.email ?? ''}> (${me.id})\n`);
  } finally {
    await client.close();
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`Example failed: ${(err as Error).message}\n`);
  process.exitCode = 1;
});
