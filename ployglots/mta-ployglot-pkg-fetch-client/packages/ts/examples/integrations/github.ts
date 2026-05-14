// @ts-nocheck
/**
 * Example: GitHub REST API v3.
 *
 * Env:
 *   GITHUB_HOST  — usually 'https://api.github.com' (override for GHE)
 *   GITHUB_USER  — username (used for sanity prints; not required for token auth)
 *   GITHUB_PASS  — a GitHub Personal Access Token
 *   HTTPS_PROXY  — optional outbound proxy.
 *
 * Endpoint exercised: GET /user — returns the authenticated user.
 *
 * Run: tsx examples/integrations/github.ts
 */
import { AsyncClient, BearerAuth } from '@polyglot/fetch-http-client';
import { buildProxy, optionalEnv, requireEnv } from '../_shared.js';

interface GithubUser {
  login: string;
  id: number;
  name: string | null;
  email: string | null;
}

async function main(): Promise<void> {
  const host = optionalEnv('GITHUB_HOST', 'https://api.github.com');
  const _user = optionalEnv('GITHUB_USER', '');
  const token = requireEnv('GITHUB_PASS');

  const proxy = buildProxy({});

  const client = new AsyncClient({
    baseUrl: host,
    auth: new BearerAuth(token),
    headers: {
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
    },
    ...(proxy ? { proxy } : {}),
  });

  try {
    const resp = await client.get('/user');
    resp.raiseForStatus();
    const me = await resp.json<GithubUser>();
    process.stdout.write(
      `GitHub ${host} → ${me.login} (${me.name ?? '<no name>'}) #${me.id}\n`,
    );
  } finally {
    await client.close();
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`GitHub example failed: ${(err as Error).message}\n`);
  process.exitCode = 1;
});
