// @ts-nocheck
/**
 * Example: Sauce Labs REST API.
 *
 * Env:
 *   SAUCELABS_HOST  — region endpoint, e.g. 'https://api.us-west-1.saucelabs.com'
 *   SAUCELABS_USER  — your Sauce Labs username
 *   SAUCELABS_PASS  — your Sauce Labs access key
 *   HTTPS_PROXY     — optional outbound proxy.
 *
 * Endpoint exercised: GET /rest/v1/users/{user}/concurrency — concurrency limits for the user.
 *
 * Run: tsx examples/integrations/saucelabs.ts
 */
import { AsyncClient, BasicAuth } from '@polyglot/fetch-http-client';
import { buildProxy, requireEnv } from '../_shared.js';

interface ConcurrencyResponse {
  concurrency: {
    organization: { allowed: { vms: number; mac_vms: number; rds: number } };
    team: { allowed: { vms: number; mac_vms: number; rds: number } };
  };
}

async function main(): Promise<void> {
  const host = requireEnv('SAUCELABS_HOST');
  const user = requireEnv('SAUCELABS_USER');
  const pass = requireEnv('SAUCELABS_PASS');

  const proxy = buildProxy({});

  const client = new AsyncClient({
    baseUrl: host,
    auth: new BasicAuth(user, pass),
    headers: { accept: 'application/json' },
    ...(proxy ? { proxy } : {}),
  });

  try {
    const resp = await client.get(`/rest/v1/users/${encodeURIComponent(user)}/concurrency`);
    resp.raiseForStatus();
    const data = await resp.json<ConcurrencyResponse>();
    process.stdout.write(
      `Sauce Labs ${host} → user ${user}: org VMs=${data.concurrency.organization.allowed.vms}, team VMs=${data.concurrency.team.allowed.vms}\n`,
    );
  } finally {
    await client.close();
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`Sauce Labs example failed: ${(err as Error).message}\n`);
  process.exitCode = 1;
});
