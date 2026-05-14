# `@polyglot/fetch-http-client`

Async HTTP client for Node.js ≥ 18, built on [`undici`](https://github.com/nodejs/undici).
Drop-in API compatible with `fetch-httpx` (the Python source whose surface this
package mirrors).

## Install

```bash
npm install @polyglot/fetch-http-client undici
```

`undici` is a peer dependency so a single copy can be deduped across packages.

## At a glance

```ts
import { AsyncClient, BasicAuth } from '@polyglot/fetch-http-client';

const client = new AsyncClient({
  baseUrl: 'https://api.example.com',
  auth: new BasicAuth('user', 'pass'),
  timeout: 5000,
  retry: { maxRetries: 3, retryOnStatus: [429, 502, 503, 504] },
});

try {
  const resp = await client.get('/users/me');
  resp.raiseForStatus();
  const me = await resp.json<{ id: string; name: string }>();
  console.log(me);
} finally {
  await client.close();
}
```

## Subpath exports

| Subpath                                  | What's inside                                                |
| ---------------------------------------- | ------------------------------------------------------------ |
| `@polyglot/fetch-http-client`            | Top barrel — clients, models, config, retry, cache, streaming |
| `@polyglot/fetch-http-client/auth`       | `BasicAuth`, `BearerAuth`, `APIKeyAuth`, `DigestAuth`, `NoAuth` |
| `@polyglot/fetch-http-client/exceptions` | 22 exception classes + `mapUndiciError` + 4 type guards       |
| `@polyglot/fetch-http-client/sdk`        | `SDK`, `CLIContext`, `AgentHTTPClient`, `PoolClient`         |

## Features

- **Full HTTP verb surface**: `get` / `post` / `put` / `patch` / `delete` / `head` / `options` / `request` (+ module-level convenience fns).
- **Auth**: `BasicAuth`, `BearerAuth` (sync + async providers), `APIKeyAuth` (custom header name), `DigestAuth` (RFC 7616).
- **Retry & resilience**: configurable retry with full/equal/decorrelated jitter, `Retry-After` honouring, idempotency-aware method gating, circuit breaker.
- **Connection pool**: `AsyncClientPool` for round-robin / balanced upstreams, `NoCloseDispatcher` for borrowed pools.
- **Cache layer**: `MemoryStorage`, `CacheManager`, `CachingClient` wrapper, `withCache` HOF, `@cached` decorator, cache-aware middleware.
- **Streaming**: `aiterBytes` / `aiterText` / `aiterLines` on `Response`; standalone `iterBytes` / `iterText` / `iterLines` / `iterNDJSON` / `iterSSE` helpers.
- **Transport control**: `DispatcherFactory` (per-origin Pool cache), `MountRouter` (URL-pattern dispatcher routing), Undici `ProxyAgent` integration.
- **Structured logger**: 6 levels, env-driven (`LOG_LEVEL`, `LOG_FORMAT=json`), automatic redaction of secrets, child contexts.
- **Type-only proxy placeholder**: every example accepts `proxy = {}` to auto-detect from `HTTPS_PROXY` / `HTTP_PROXY`.

## Example: 6 service integrations

Runnable examples live under `examples/integrations/` for JIRA, Confluence,
GitHub, Figma, Statsig, and Sauce Labs. Each follows the
`<SERVICE>_HOST/USER/PASS` env-var contract and uses `buildProxy({})` from
`examples/_shared.ts` to pick up an optional outbound proxy.

```bash
JIRA_HOST=https://acme.atlassian.net \
JIRA_USER=you@acme.com \
JIRA_PASS=$(pass jira-token) \
npx tsx packages/ts/examples/integrations/jira.ts
```

See [`examples/README.md`](examples/README.md) for the full table of providers
and the env contract.

## Testing

| Layer       | Where                                | Run                                         |
| ----------- | ------------------------------------ | ------------------------------------------- |
| Unit        | `src/**/*.test.ts`                   | `make test`                                 |
| Integration | `tests/integration/*.test.ts`        | `make test-integration` (requires env vars) |

Integration tests use `it.skipIf(...)` so the suite still passes when you
don't have credentials for every provider.

## Make targets

```
make help            # list all targets
make ci              # ci-install → lint → test → build (full pipeline)
make test            # unit tests only
make test-integration# live-provider tests (env-gated)
make build           # produce dist/ via tsup
make pack            # produce a publishable .tgz
make clean           # remove dist + coverage
```

## Optional proxy contract

Every example defaults to `proxy = {}` — the empty bag means
"auto-detect from env":

```ts
import { buildProxy } from '../examples/_shared.js';

// auto-detect HTTPS_PROXY / HTTP_PROXY (default)
const proxy = buildProxy({});

// explicit override
const explicit = buildProxy({
  host: 'http://corp-proxy.internal:3128',
  user: 'svc',
  pass: process.env.PROXY_SECRET,
});

const client = new AsyncClient({
  baseUrl: 'https://api.example.com',
  ...(proxy ? { proxy } : {}),
});
```

When `buildProxy(...)` returns `undefined` (no env, no override), callers
omit the `proxy:` field entirely so the request goes direct.

## Response status fields

| Field          | Type    | Description                                                   |
| -------------- | ------- | ------------------------------------------------------------- |
| `statusCode`   | number  | HTTP status code (camelCase form, original).                  |
| `status_code`  | number  | Snake-case alias for `statusCode`. Cross-language parity.     |
| `status`       | string  | Textual reason phrase (e.g. `"OK"`, `"Not Found"`).           |

> ⚠️ `Response.status` is the TEXT here — opposite of the Web Fetch API where
> `Response.status` is the integer. Use `status_code` (or `statusCode`) when
> you need the integer.

## License

MIT
