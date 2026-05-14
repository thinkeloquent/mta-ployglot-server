// @ts-nocheck
/**
 * Example: Figma REST API.
 *
 * Env:
 *   FIGMA_HOST  — usually 'https://api.figma.com'
 *   FIGMA_USER  — placeholder (Figma uses token auth only; kept for symmetry)
 *   FIGMA_PASS  — a Figma Personal Access Token
 *   HTTPS_PROXY — optional outbound proxy.
 *
 * Endpoint exercised: GET /v1/me — returns the authenticated user.
 *
 * Run: tsx examples/integrations/figma.ts
 */
import { AsyncClient, APIKeyAuth } from '@polyglot/fetch-http-client';
import { buildProxy, optionalEnv, requireEnv } from '../_shared.js';

interface FigmaUser {
  id: string;
  email: string;
  handle: string;
}

async function main(): Promise<void> {
  const host = optionalEnv('FIGMA_HOST', 'https://api.figma.com');
  const _user = optionalEnv('FIGMA_USER', '');
  const token = requireEnv('FIGMA_PASS');

  const proxy = buildProxy({});

  const client = new AsyncClient({
    baseUrl: host,
    // Figma uses the X-Figma-Token header (not Authorization).
    auth: new APIKeyAuth(token, 'X-Figma-Token'),
    headers: { accept: 'application/json' },
    ...(proxy ? { proxy } : {}),
  });

  try {
    const resp = await client.get('/v1/me');
    resp.raiseForStatus();
    const me = await resp.json<FigmaUser>();
    process.stdout.write(`Figma ${host} → @${me.handle} <${me.email}> (${me.id})\n`);
  } finally {
    await client.close();
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`Figma example failed: ${(err as Error).message}\n`);
  process.exitCode = 1;
});
