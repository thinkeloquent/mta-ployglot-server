# Integration Examples

Third-party service integrations built on `@polyglot/fetch-http-client`. Every
example follows the same shape:

- Secrets come from environment variables — **never** hard-code.
- An optional outbound proxy is picked up from `HTTPS_PROXY` / `HTTP_PROXY`
  and passed to the client as a `Proxy` instance when set.
- The client is closed in `finally` so the underlying `undici.Pool` sockets
  release cleanly.

## Shared helpers

[`../_shared.ts`](../_shared.ts) exposes three tiny helpers used by every file:

- `requireEnv(name)` — throw with a clear message if unset.
- `optionalEnv(name, fallback)` — fall back to a provider default host.
- `buildProxy({ host?, user?, pass? })` — return a `Proxy` from the options
  bag, falling back to `HTTPS_PROXY` / `HTTP_PROXY` / `HTTP_PROXY_USER` /
  `HTTP_PROXY_PASS` env vars for any field left empty. Pass `{}` to rely
  entirely on env; pass explicit fields to override.

## Integrations

| Service    | File                             | Auth                               | Env (host / user / pass)                                  |
| ---------- | -------------------------------- | ---------------------------------- | --------------------------------------------------------- |
| JIRA       | [`jira.ts`](jira.ts)             | HTTP Basic (email + API token)     | `JIRA_HOST` / `JIRA_USER` / `JIRA_PASS`                   |
| Confluence | [`confluence.ts`](confluence.ts) | HTTP Basic (email + API token)     | `CONFLUENCE_HOST` / `CONFLUENCE_USER` / `CONFLUENCE_PASS` |
| GitHub     | [`github.ts`](github.ts)         | Bearer (PAT)                       | `GITHUB_HOST` / `GITHUB_USER` / `GITHUB_PASS` (token)     |
| Figma      | [`figma.ts`](figma.ts)           | `X-Figma-Token` header             | `FIGMA_HOST` / `FIGMA_USER` / `FIGMA_PASS` (token)        |
| Statsig    | [`statsig.ts`](statsig.ts)       | `STATSIG-API-KEY` header           | `STATSIG_HOST` / `STATSIG_USER` / `STATSIG_PASS`          |
| Sauce Labs | [`saucelabs.ts`](saucelabs.ts)   | HTTP Basic (username + access key) | `SAUCELABS_HOST` / `SAUCELABS_USER` / `SAUCELABS_PASS`    |

## Running an example

```bash
cd packages/ts
make build   # examples import the built package via the workspace symlink

# Without a proxy:
JIRA_HOST=https://acme.atlassian.net \
JIRA_USER=dev@acme.io \
JIRA_PASS=atl-xxxxxxxxxxxx \
  npx tsx examples/integrations/jira.ts

# With a forward proxy:
HTTPS_PROXY=http://proxy.internal:3128 \
JIRA_HOST=https://acme.atlassian.net \
JIRA_USER=dev@acme.io \
JIRA_PASS=atl-xxxxxxxxxxxx \
  npx tsx examples/integrations/jira.ts
```

## Proxy placeholder — how it works

Every integration example writes `const proxy = buildProxy({});` — an empty
options bag is always visible in the code, so callers see exactly where to
plug a proxy in. Three common call shapes:

```ts
// 1) Empty `{}` — auto-detect from env. This is the default in every example.
const proxy = buildProxy({});

// 2) Explicit host only (user/pass still from env if present).
const proxy = buildProxy({ host: 'http://proxy.internal:3128' });

// 3) Full override — host + auth baked into the Proxy.
const proxy = buildProxy({
  host: 'http://proxy.internal:3128',
  user: process.env.CORP_PROXY_USER,
  pass: process.env.CORP_PROXY_PASS,
});
```

`buildProxy({})` returns `undefined` when no proxy host is discoverable. The
examples then conditionally spread the field so `proxy:` is **absent** on
the client options when no proxy is configured:

```ts
const client = new AsyncClient({
  baseUrl: host,
  auth: /* ... */,
  ...(proxy ? { proxy } : {}),
});
```

Same code path on a laptop (no proxy), in a CI runner behind a corporate
proxy, and through `mitmproxy` for recording — just add `HTTPS_PROXY` to the
environment or pass explicit fields to `buildProxy({})`.

## Testing the examples without credentials

To smoke-test the example scaffolding offline, point the `*_HOST` env at a
local mock server:

```bash
# Terminal 1 — a throwaway mock server.
node --input-type=module <<'EOF'
import http from 'node:http';
http.createServer((_req, res) => {
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ accountId: 'x', displayName: 'Mock', emailAddress: 'm@x.io' }));
}).listen(3000, () => console.log('mock listening on :3000'));
EOF

# Terminal 2 — point the JIRA example at it.
JIRA_HOST=http://localhost:3000 JIRA_USER=x JIRA_PASS=y \
  npx tsx examples/integrations/jira.ts
```

The example will authenticate, hit the mock, and print the decoded JSON.
