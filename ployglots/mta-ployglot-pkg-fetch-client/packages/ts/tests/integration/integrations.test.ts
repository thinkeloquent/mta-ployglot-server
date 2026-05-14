// @ts-nocheck
/**
 * Integration tests against live provider APIs.
 *
 * Each test is `it.skipIf(missing(...))` so the suite passes cleanly when a
 * developer doesn't have credentials for every provider.
 */
import { describe, expect, it } from 'vitest';
import {
  AsyncClient,
  APIKeyAuth,
  BasicAuth,
  BearerAuth,
} from '../../src/index.js';

function missing(names: string[]): boolean {
  return names.some((n) => !process.env[n] || process.env[n]?.length === 0);
}

function envProxyOpts(): { url: string } | undefined {
  const url = process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY;
  return url ? { url } : undefined;
}

describe('integrations: JIRA', () => {
  it.skipIf(missing(['JIRA_HOST', 'JIRA_USER', 'JIRA_PASS']))(
    'GET /rest/api/3/myself returns caller profile',
    async () => {
      const client = new AsyncClient({
        baseUrl: process.env.JIRA_HOST!,
        auth: new BasicAuth(process.env.JIRA_USER!, process.env.JIRA_PASS!),
        headers: { accept: 'application/json' },
        ...(envProxyOpts() ? { proxy: envProxyOpts() } : {}),
      });
      try {
        const resp = await client.get('/rest/api/3/myself');
        expect(resp.statusCode).toBe(200);
        const me = await resp.json<{ accountId: string; displayName: string }>();
        expect(typeof me.accountId).toBe('string');
        expect(typeof me.displayName).toBe('string');
      } finally {
        await client.close();
      }
    },
  );
});

describe('integrations: Confluence', () => {
  it.skipIf(missing(['CONFLUENCE_HOST', 'CONFLUENCE_USER', 'CONFLUENCE_PASS']))(
    'GET /api/v2/spaces returns 200',
    async () => {
      const client = new AsyncClient({
        baseUrl: process.env.CONFLUENCE_HOST!,
        auth: new BasicAuth(process.env.CONFLUENCE_USER!, process.env.CONFLUENCE_PASS!),
        headers: { accept: 'application/json' },
        ...(envProxyOpts() ? { proxy: envProxyOpts() } : {}),
      });
      try {
        const resp = await client.get('/api/v2/spaces', { params: { limit: 5 } });
        expect(resp.statusCode).toBe(200);
        const data = await resp.json<{ results: unknown[] }>();
        expect(Array.isArray(data.results)).toBe(true);
      } finally {
        await client.close();
      }
    },
  );
});

describe('integrations: GitHub', () => {
  it.skipIf(missing(['GITHUB_PASS']))('GET /user returns the authenticated user', async () => {
    const client = new AsyncClient({
      baseUrl: process.env.GITHUB_HOST ?? 'https://api.github.com',
      auth: new BearerAuth(process.env.GITHUB_PASS!),
      headers: {
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
      },
      ...(envProxyOpts() ? { proxy: envProxyOpts() } : {}),
    });
    try {
      const resp = await client.get('/user');
      expect(resp.statusCode).toBe(200);
      const me = await resp.json<{ login: string; id: number }>();
      expect(typeof me.login).toBe('string');
      expect(typeof me.id).toBe('number');
    } finally {
      await client.close();
    }
  });
});

describe('integrations: Figma', () => {
  it.skipIf(missing(['FIGMA_PASS']))('GET /v1/me returns the authenticated user', async () => {
    const client = new AsyncClient({
      baseUrl: process.env.FIGMA_HOST ?? 'https://api.figma.com',
      auth: new APIKeyAuth(process.env.FIGMA_PASS!, 'X-Figma-Token'),
      headers: { accept: 'application/json' },
      ...(envProxyOpts() ? { proxy: envProxyOpts() } : {}),
    });
    try {
      const resp = await client.get('/v1/me');
      expect(resp.statusCode).toBe(200);
      const me = await resp.json<{ id: string; handle: string }>();
      expect(typeof me.id).toBe('string');
      expect(typeof me.handle).toBe('string');
    } finally {
      await client.close();
    }
  });
});

describe('integrations: Statsig', () => {
  it.skipIf(missing(['STATSIG_PASS']))('GET /console/v1/feature_gates returns 200', async () => {
    const client = new AsyncClient({
      baseUrl: process.env.STATSIG_HOST ?? 'https://statsigapi.net',
      auth: new APIKeyAuth(process.env.STATSIG_PASS!, 'STATSIG-API-KEY'),
      headers: { accept: 'application/json' },
      ...(envProxyOpts() ? { proxy: envProxyOpts() } : {}),
    });
    try {
      const resp = await client.get('/console/v1/feature_gates');
      expect(resp.statusCode).toBe(200);
      const data = await resp.json<{ data: unknown[] }>();
      expect(Array.isArray(data.data)).toBe(true);
    } finally {
      await client.close();
    }
  });
});

describe('integrations: Sauce Labs', () => {
  it.skipIf(missing(['SAUCELABS_HOST', 'SAUCELABS_USER', 'SAUCELABS_PASS']))(
    'GET /rest/v1/users/{user}/concurrency returns 200',
    async () => {
      const user = process.env.SAUCELABS_USER!;
      const client = new AsyncClient({
        baseUrl: process.env.SAUCELABS_HOST!,
        auth: new BasicAuth(user, process.env.SAUCELABS_PASS!),
        headers: { accept: 'application/json' },
        ...(envProxyOpts() ? { proxy: envProxyOpts() } : {}),
      });
      try {
        const resp = await client.get(`/rest/v1/users/${encodeURIComponent(user)}/concurrency`);
        expect(resp.statusCode).toBe(200);
        const data = await resp.json<{ concurrency: { team: { allowed: { vms: number } } } }>();
        expect(typeof data.concurrency.team.allowed.vms).toBe('number');
      } finally {
        await client.close();
      }
    },
  );
});
