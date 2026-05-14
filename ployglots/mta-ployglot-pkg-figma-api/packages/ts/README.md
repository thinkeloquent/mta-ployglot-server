# @polyglot/figma-api

TypeScript client for the Figma REST API, layered on top of
[`@polyglot/fetch-http-client`][fetch-client]. Token auth, env-driven
config, proxy-aware, pluggable transport.

[fetch-client]: https://github.com/thinkeloquent/mta-ployglot-pkg-fetch-client

## Install

This package is linked to the sibling fetch-client workspace via a
`file:` reference. Install from the repo root:

```bash
npm install           # at the repo root — installs workspaces
```

## Quickstart

```ts
import { FigmaClient } from '@polyglot/figma-api';

// `proxy: {}` auto-detects from HTTPS_PROXY / HTTP_PROXY env.
// `token` falls back to env FIGMA_PASS.
const client = new FigmaClient({ proxy: {} });

try {
  const me = await client.me.get();
  console.log(`@${me.handle}`);
} finally {
  await client.close();
}
```

## Environment

| Var               | Required | Description                                              |
| ----------------- | :------: | -------------------------------------------------------- |
| `FIGMA_HOST`      |          | Default `https://api.figma.com`.                         |
| `FIGMA_USER`      |          | Placeholder — Figma is token-only.                       |
| `FIGMA_PASS`      |    ✔     | Figma Personal Access Token.                             |
| `HTTPS_PROXY`     |          | Outbound HTTPS proxy.                                    |
| `HTTP_PROXY`      |          | Outbound HTTP proxy.                                     |
| `HTTP_PROXY_USER` |          | Proxy username.                                          |
| `HTTP_PROXY_PASS` |          | Proxy password.                                          |

## Proxy contract

`proxy` is an options bag that follows the same shape used by the
sibling fetch-http-client integration examples.

```ts
new FigmaClient({ token, proxy: {} });                    // auto-detect
new FigmaClient({ token, proxy: { host: 'http://p:3128' } });
new FigmaClient({ token, proxy: { host: 'http://p:3128', user: 'u', pass: 'p' } });
```

When no proxy is discoverable, the helper returns `undefined` and the
underlying fetch client is constructed without a `proxy:` field — so
`proxy = {}` is the always-safe zero-config call.

## BYO fetch client

Bring your own `@polyglot/fetch-http-client` `AsyncClient` to compose
retry, circuit breaker, or caching behavior on top:

```ts
import { AsyncClient, APIKeyAuth } from '@polyglot/fetch-http-client';
import { FigmaClient, fetchClientFromPolyglot } from '@polyglot/figma-api';

const outer = new AsyncClient({
  baseUrl: 'https://api.figma.com',
  auth: new APIKeyAuth(process.env.FIGMA_PASS!, 'X-Figma-Token'),
  retry: { maxRetries: 5 },
});

const client = new FigmaClient({
  token: process.env.FIGMA_PASS!,
  fetchClient: fetchClientFromPolyglot(outer),
});
```

## Public surface

| Export                                 | Purpose                                                          |
| -------------------------------------- | ---------------------------------------------------------------- |
| `FigmaClient`                          | SDK entry point. Exposes all 9 resource sub-SDKs listed below.   |
| `createFigmaFetchClient`               | Build a standalone FetchClient from env + options.               |
| `fetchClientFromPolyglot`              | Wrap a user `AsyncClient` as a FetchClient (BYO).                |
| `resolveFigmaConfig`                   | Merge explicit options with env.                                 |
| `buildProxy`                           | Build a `Proxy` from bag + env fallbacks.                        |
| `buildFigmaRetryConfig`, `FIGMA_DEFAULT_RETRY` | Figma-sensible retry presets + the compiler that honours `forceOverwrite`. |
| `FigmaError` + subclasses              | Typed error tree (Auth / NotFound / RateLimit / Server / Transport / Config). |
| `createLogger`, `maskToken`            | Structured logger + token masking.                               |

### Resource surface on `FigmaClient`

| Accessor              | Endpoints                                  | Tier       |
| --------------------- | ------------------------------------------ | ---------- |
| `client.me`           | GET `/v1/me`                               | basic      |
| `client.files`        | GET file / nodes / images / imageFills / meta / versions | basic |
| `client.comments`     | CRUD comments + reactions                  | basic      |
| `client.projects`     | team projects, project files               | basic      |
| `client.components`   | team/file/get for components, component_sets, styles | basic |
| `client.variables`    | local / published / post                   | **enterprise** |
| `client.devResources` | list / create / update / delete            | basic      |
| `client.libraryAnalytics` | 6 actions/usages endpoints             | **enterprise** |
| `client.webhooks`     | create / get / update / delete / listForTeam / requests | basic (v2) |

### Retry semantics

By default `FigmaClient` pre-wires Figma-sensible retry on the
underlying `AsyncClient`:

```
maxRetries        3
retryDelay        1000ms
retryBackoff      2   (1s → 2s → 4s, capped at maxRetryDelay)
maxRetryDelay     30000ms
retryOnStatus     [429, 500, 502, 503, 504]
respectRetryAfter true
```

Override patterns (matching the plan's F05 retry composition modes):

```ts
new FigmaClient({ token });                          // Mode A: Figma defaults
new FigmaClient({ token, retry: false });            // Mode B: outer owns retry
new FigmaClient({ token, retry: { maxRetries: 5 } }); // merge on top
new FigmaClient({
  token,
  retry: { maxRetries: 1, retryOnStatus: [503] },
  forceOverwriteRetry: true,                          // replace, don't merge
});
```

## Testing

```bash
make test                 # unit (vitest, mocked transport)
make test-integration     # live API (needs FIGMA_PASS)
make lint                 # prettier + tsc --noEmit
make build                # emit to ./dist
make ci                   # full pipeline
```

## Server integration

This package ships **SDK only**. Three reference wiring patterns for
Fastify live under
[`examples/servers/`](examples/servers/) — plugin, lifecycle hooks,
decorators. Each runs against a scratch project (`npm i fastify
fastify-plugin @polyglot/figma-api`).

## Publishing

At publish time, swap the local `file:` reference to
`@polyglot/fetch-http-client` for a registry version — `file:` deps
don't travel with a published tarball. The `files` allowlist already
ships only `dist/` + `README.md`. To audit the actual tarball
contents end-to-end:

```bash
make pack                 # writes ./artifacts/*.tgz
npm pack --dry-run        # prints the file list without emitting
```

For a full round-trip: install the tarball in a scratch project with
`npm i ./artifacts/polyglot-figma-api-0.1.0.tgz`, import it, run a
smoke call.

## License

MIT.
