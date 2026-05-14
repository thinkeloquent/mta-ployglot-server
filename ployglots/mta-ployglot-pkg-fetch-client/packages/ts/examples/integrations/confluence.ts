// @ts-nocheck
/**
 * Example: Confluence Cloud REST API v2.
 *
 * Env:
 *   CONFLUENCE_HOST  — e.g. 'https://your-domain.atlassian.net/wiki'
 *   CONFLUENCE_USER  — your Atlassian email
 *   CONFLUENCE_PASS  — a Confluence API token
 *   HTTPS_PROXY      — optional outbound proxy.
 *
 * Endpoint exercised: GET /api/v2/spaces?limit=5 — first 5 spaces visible to caller.
 *
 * Run: tsx examples/integrations/confluence.ts
 */
import { AsyncClient, BasicAuth } from '@polyglot/fetch-http-client';
import { buildProxy, requireEnv } from '../_shared.js';

interface ConfluenceSpace {
  id: string;
  key: string;
  name: string;
}

async function main(): Promise<void> {
  const host = requireEnv('CONFLUENCE_HOST');
  const user = requireEnv('CONFLUENCE_USER');
  const pass = requireEnv('CONFLUENCE_PASS');

  const proxy = buildProxy({});

  const client = new AsyncClient({
    baseUrl: host,
    auth: new BasicAuth(user, pass),
    headers: { accept: 'application/json' },
    ...(proxy ? { proxy } : {}),
  });

  try {
    const resp = await client.get('/api/v2/spaces', { params: { limit: 5 } });
    resp.raiseForStatus();
    const data = await resp.json<{ results: ConfluenceSpace[] }>();
    process.stdout.write(`Confluence ${host} → ${data.results.length} spaces:\n`);
    for (const s of data.results) {
      process.stdout.write(`  - ${s.key}: ${s.name} (${s.id})\n`);
    }
  } finally {
    await client.close();
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`Confluence example failed: ${(err as Error).message}\n`);
  process.exitCode = 1;
});
