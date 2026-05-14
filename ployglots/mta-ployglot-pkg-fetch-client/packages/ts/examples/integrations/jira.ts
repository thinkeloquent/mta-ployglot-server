// @ts-nocheck
/**
 * Example: JIRA REST API v3.
 *
 * Env:
 *   JIRA_HOST  — e.g. 'https://your-domain.atlassian.net'
 *   JIRA_USER  — your Atlassian email
 *   JIRA_PASS  — a JIRA API token
 *     (https://id.atlassian.com/manage-profile/security/api-tokens)
 *   HTTPS_PROXY — optional outbound proxy, picked up by buildProxy({}).
 *
 * Endpoint exercised: GET /rest/api/3/myself — returns the caller's profile.
 *
 * Run: tsx examples/integrations/jira.ts
 */
import { AsyncClient, BasicAuth } from '@polyglot/fetch-http-client';
import { buildProxy, requireEnv } from '../_shared.js';

async function main(): Promise<void> {
  const host = requireEnv('JIRA_HOST');
  const user = requireEnv('JIRA_USER');
  const pass = requireEnv('JIRA_PASS');

  // proxy = {} → auto-detect from HTTPS_PROXY / HTTP_PROXY.
  // Pass { host, user, pass } to override explicitly.
  const proxy = buildProxy({});

  const client = new AsyncClient({
    baseUrl: host,
    auth: new BasicAuth(user, pass),
    headers: { accept: 'application/json' },
    ...(proxy ? { proxy } : {}),
  });

  try {
    const resp = await client.get('/rest/api/3/myself');
    resp.raiseForStatus();
    const me = await resp.json<{
      accountId: string;
      displayName: string;
      emailAddress: string;
    }>();
    process.stdout.write(
      `JIRA ${host} → ${me.displayName} <${me.emailAddress}> (${me.accountId})\n`,
    );
  } finally {
    await client.close();
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`JIRA example failed: ${(err as Error).message}\n`);
  process.exitCode = 1;
});
