// @ts-nocheck
/**
 * Example: BYO (bring-your-own) fetch client — wrap a user-configured
 * `@polyglot/fetch-http-client` AsyncClient and pass it to FigmaClient.
 *
 * This is the "Mode B / Mode C" retry composition from the plan:
 * the outer AsyncClient owns retry + circuit breaker, and the inner
 * FigmaClient just sits on top.
 *
 * Env:
 *   FIGMA_PASS  required
 *
 * Run:
 *   FIGMA_PASS=$YOUR_TOKEN npx tsx examples/sdk/03-byo-fetch-client.ts
 */

import { APIKeyAuth, AsyncClient } from '@polyglot/fetch-http-client';
import { FigmaClient, fetchClientFromPolyglot } from '@polyglot/figma-api';

async function main(): Promise<void> {
  const token = process.env.FIGMA_PASS;
  if (!token) {
    throw new Error('Missing env FIGMA_PASS');
  }

  const outer = new AsyncClient({
    baseUrl: 'https://api.figma.com',
    auth: new APIKeyAuth(token, 'X-Figma-Token'),
    headers: { accept: 'application/json' },
    retry: { maxRetries: 3 },
  });

  const client = new FigmaClient({
    token,
    fetchClient: fetchClientFromPolyglot(outer),
  });

  try {
    const me = await client.me.get();
    process.stdout.write(`Figma (BYO) → @${me.handle}\n`);
  } finally {
    await client.close();
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`Example failed: ${(err as Error).message}\n`);
  process.exitCode = 1;
});
