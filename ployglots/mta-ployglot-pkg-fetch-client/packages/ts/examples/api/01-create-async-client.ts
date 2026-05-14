// @ts-nocheck
/**
 * Example: tuned `AsyncClient` defaults for an LLM-style API.
 *
 * `@polyglot/fetch-http-client` exposes `AsyncClient` directly (vs. a thin
 * `createFetchHttpxClient` factory). The constructor accepts the full
 * `AsyncClientOptions` shape — auth, timeout, retry, circuitBreaker, eventHooks,
 * etc. — so most "factory with defaults" patterns collapse to a single ctor call
 * with named fields.
 *
 * Defaults illustrated:
 *   - connect/read timeouts via `Timeout` shorthand.
 *   - followRedirects on with maxRedirects bumped to 10.
 *   - bearer auth pulled from env (LLM_API_KEY).
 *   - retry on 429/5xx with full jitter.
 */
import { AsyncClient, BearerAuth, JitterStrategy } from '@polyglot/fetch-http-client';

async function main(): Promise<void> {
  const client = new AsyncClient({
    timeout: { connect: 5000, read: 120_000, write: 30_000 },
    auth: new BearerAuth(process.env.LLM_API_KEY ?? 'sk-test'),
    headers: { 'user-agent': 'fetch-http-client-example/1.0' },
    followRedirects: true,
    maxRedirects: 10,
    retry: {
      maxRetries: 3,
      retryDelay: 1000,
      retryBackoff: 2,
      jitter: JitterStrategy.FULL,
      retryOnStatus: [429, 502, 503, 504],
    },
  });
  try {
    const resp = await client.post('https://api.example.com/v1/chat', {
      json: { model: 'example-2', messages: [{ role: 'user', content: 'hello' }] },
    });
    console.log('status:', resp.statusCode);
    console.log('body:', await resp.text());
  } finally {
    await client.close();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
