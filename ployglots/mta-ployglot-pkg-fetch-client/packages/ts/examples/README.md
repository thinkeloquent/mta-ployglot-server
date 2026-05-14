# `@polyglot/fetch-http-client` Examples

Runnable TypeScript examples for the package. Each file under `api/`, `sdk/`,
`cli/`, and `integrations/` is self-contained and can be executed with `tsx`:

```bash
cd packages/ts
npx tsx examples/api/01-create-async-client.ts
```

## Layout

```
examples/
├── _shared.ts                              # requireEnv + buildProxy helpers
├── api/
│   ├── 01-create-async-client.ts           # tuned AsyncClient defaults
│   ├── 02-client-verb-methods.ts           # client.get / client.post + typed json<T>()
│   └── 03-event-hooks.ts                   # onRequest / onResponse hooks
├── sdk/
│   ├── 01-basic-get.ts                     # createSDK({ baseUrl }) end-to-end
│   └── 02-caching-client.ts                # CachingClient with stats() reporting
├── cli/
│   ├── 01-one-off-request.sh               # CLIContext.request via Node wrapper
│   └── 02-download-with-progress.sh        # CLIContext.download(...) + onProgress
└── integrations/
    ├── jira.ts                             # JIRA            — Basic auth (email + API token)
    ├── confluence.ts                       # Confluence       — Basic auth (email + API token)
    ├── github.ts                           # GitHub          — Bearer (PAT)
    ├── figma.ts                            # Figma           — X-Figma-Token header
    ├── statsig.ts                          # Statsig Console — STATSIG-API-KEY header
    └── saucelabs.ts                        # Sauce Labs      — Basic auth (username + access key)
```

## Index

| Area | File                                                                       | Illustrates                                                                            |
| ---- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| api  | [`api/01-create-async-client.ts`](api/01-create-async-client.ts)           | Tuned `AsyncClient` defaults: timeouts, bearer auth, retry with full jitter.           |
| api  | [`api/02-client-verb-methods.ts`](api/02-client-verb-methods.ts)           | `client.get` / `client.post` with query params, JSON body, typed `response.json<T>()`. |
| api  | [`api/03-event-hooks.ts`](api/03-event-hooks.ts)                           | `onRequest` / `onResponse` hooks for request-id propagation + response timing.         |
| sdk  | [`sdk/01-basic-get.ts`](sdk/01-basic-get.ts)                               | `createSDK({ baseUrl })` returns typed `SDKResponse<T>` with retry built in.           |
| sdk  | [`sdk/02-caching-client.ts`](sdk/02-caching-client.ts)                     | `CachingClient` — second call served from memory; `.cache.stats()` reports hits.       |
| cli  | [`cli/01-one-off-request.sh`](cli/01-one-off-request.sh)                   | Shell snippet showing `CLIContext.request(...)`.                                       |
| cli  | [`cli/02-download-with-progress.sh`](cli/02-download-with-progress.sh)     | `CLIContext.download(...)` with `onProgress` callback + POSIX exit codes.              |
| int  | [`integrations/jira.ts`](integrations/jira.ts)                             | JIRA REST API v3 — Basic auth + optional proxy.                                        |
| int  | [`integrations/confluence.ts`](integrations/confluence.ts)                 | Confluence Cloud — Basic auth + optional proxy.                                        |
| int  | [`integrations/github.ts`](integrations/github.ts)                         | GitHub REST — Bearer PAT + optional proxy.                                             |
| int  | [`integrations/figma.ts`](integrations/figma.ts)                           | Figma — `X-Figma-Token` header + optional proxy.                                       |
| int  | [`integrations/statsig.ts`](integrations/statsig.ts)                       | Statsig Console API — `STATSIG-API-KEY` header + optional proxy.                       |
| int  | [`integrations/saucelabs.ts`](integrations/saucelabs.ts)                   | Sauce Labs — Basic auth (username + access key) + optional proxy.                      |

Integration examples are grouped under [`integrations/`](integrations/) and
share an [`_shared.ts`](_shared.ts) helper for env resolution and the
`HTTPS_PROXY` pickup. See [`integrations/README.md`](integrations/README.md) for
the full env contract and the `proxy = {}` placeholder convention.

## Env-var convention (integrations)

Every integration accepts `<SERVICE>_HOST`, `<SERVICE>_USER`, `<SERVICE>_PASS`
(plus the standard proxy env vars). Examples that don't use a username (Figma,
Statsig, GitHub) still accept `<SERVICE>_USER` for symmetry; it's read with
`optionalEnv(...)` and ignored.

| Service    | HOST                                              | USER             | PASS                  |
| ---------- | ------------------------------------------------- | ---------------- | --------------------- |
| JIRA       | `https://<your-domain>.atlassian.net`             | Atlassian email  | JIRA API token        |
| Confluence | `https://<your-domain>.atlassian.net/wiki`        | Atlassian email  | Confluence API token  |
| GitHub     | `https://api.github.com` (or your GHE host)       | username (any)   | GitHub PAT            |
| Figma      | `https://api.figma.com`                           | (unused)         | Figma PAT             |
| Statsig    | `https://statsigapi.net`                          | (unused)         | Console API key       |
| Sauce Labs | `https://api.<region>.saucelabs.com`              | Sauce username   | Sauce access key      |

## Optional proxy

Every integration example calls `buildProxy({})` from `_shared.ts`. The empty
object means "auto-detect from `HTTPS_PROXY` / `HTTP_PROXY`". Pass
`{ host, user, pass }` to override explicitly. When `buildProxy(...)` returns
`undefined`, the example omits the `proxy:` field on the client via
`...(proxy ? { proxy } : {})`.

```ts
import { buildProxy } from '../_shared.js';

// auto-detect from env
const proxy = buildProxy({});

// explicit override (env vars are ignored when host is provided)
const explicit = buildProxy({
  host: 'http://corp-proxy.internal:3128',
  user: 'svc-account',
  pass: process.env.PROXY_SECRET,
});
```

## Running an example

The examples import from the **built** package (`@polyglot/fetch-http-client`
resolved through the workspace), so build first:

```bash
make -C packages/ts build
npx tsx packages/ts/examples/api/02-client-verb-methods.ts
```

For the integration examples, set the relevant env vars first:

```bash
JIRA_HOST=https://acme.atlassian.net \
JIRA_USER=you@acme.com \
JIRA_PASS=$(pass jira-token) \
npx tsx packages/ts/examples/integrations/jira.ts
```

To send the request through a corporate proxy, set `HTTPS_PROXY` in your shell.
The `proxy = {}` placeholder in each example will pick it up automatically.

## Offline smoke testing

Point the `*_HOST` env at a local mock server:

```bash
node --no-warnings -e 'require("http").createServer((_q,r)=>{r.end("{\"ok\":true}")}).listen(3000)'
```

Then run an example with the matching `*_HOST=http://localhost:3000` env var.

## Integration tests

End-to-end tests that hit live providers live under `tests/integration/`. They
share the same env-var contract and are skipped when the required env vars are
missing — see [`../tests/integration/README.md`](../tests/integration/README.md).
