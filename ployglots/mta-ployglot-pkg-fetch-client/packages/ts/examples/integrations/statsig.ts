// @ts-nocheck
/**
 * Example: Statsig Console API (public docs: https://docs.statsig.com/console-api/introduction).
 *
 * Env:
 *   STATSIG_HOST  — usually 'https://statsigapi.net'
 *   STATSIG_USER  — placeholder (kept for ENV symmetry; Statsig uses token-only auth)
 *   STATSIG_PASS  — a Console API key (server secret)
 *   HTTPS_PROXY   — optional outbound proxy.
 *
 * Endpoint exercised: GET /console/v1/feature_gates — first page of gates in the project.
 *
 * Run: tsx examples/integrations/statsig.ts
 */
import { AsyncClient, APIKeyAuth } from '@polyglot/fetch-http-client';
import { buildProxy, optionalEnv, requireEnv } from '../_shared.js';

interface FeatureGate {
  id: string;
  name: string;
  isEnabled: boolean;
}

async function main(): Promise<void> {
  const host = optionalEnv('STATSIG_HOST', 'https://statsigapi.net');
  const _user = optionalEnv('STATSIG_USER', '');
  const token = requireEnv('STATSIG_PASS');

  const proxy = buildProxy({});

  const client = new AsyncClient({
    baseUrl: host,
    // Statsig Console API uses the STATSIG-API-KEY header.
    auth: new APIKeyAuth(token, 'STATSIG-API-KEY'),
    headers: { accept: 'application/json' },
    ...(proxy ? { proxy } : {}),
  });

  try {
    const resp = await client.get('/console/v1/feature_gates');
    resp.raiseForStatus();
    const data = await resp.json<{ data: FeatureGate[] }>();
    process.stdout.write(`Statsig ${host} → ${data.data.length} feature gates:\n`);
    for (const g of data.data.slice(0, 5)) {
      process.stdout.write(`  - ${g.id} (${g.name}) enabled=${g.isEnabled}\n`);
    }
  } finally {
    await client.close();
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`Statsig example failed: ${(err as Error).message}\n`);
  process.exitCode = 1;
});
