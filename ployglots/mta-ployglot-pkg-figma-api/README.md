# mta-ployglot-pkg-figma-api

Polyglot Figma API workspace. Two twin packages that wrap the Figma
REST API on top of [`@polyglot/fetch-http-client`][fetch-client], with
a pluggable fetch contract, env-driven config (`FIGMA_HOST` /
`FIGMA_USER` / `FIGMA_PASS`), and the standard `proxy = {}`
auto-detection placeholder.

[fetch-client]: https://github.com/thinkeloquent/mta-ployglot-pkg-fetch-client

## Packages

| Package                        | Description                                                          |
| ------------------------------ | -------------------------------------------------------------------- |
| [`packages/ts/`](packages/ts/) | `@polyglot/figma-api` — TypeScript client. Node ≥ 20, ESM `NodeNext`. |
| [`packages/py/`](packages/py/) | `polyglot-figma-api` — Python twin on top of `httpx`. Python ≥ 3.11.  |

## Quickstart

```bash
# TypeScript side
make -C packages/ts ci                 # ci-install → lint → test → build
make -C packages/ts test-integration   # live-API tests (needs FIGMA_PASS)

# Python side
make -C packages/py ci                 # ci-install → lint → test
make -C packages/py test-integration   # live-API tests (needs FIGMA_PASS)

# Both at once
make ci
```

## Environment

Every entry point (SDK + examples + integration tests) follows the
`<SERVICE>_HOST/USER/PASS` + proxy convention used by the sibling
`@polyglot/fetch-http-client` integrations:

| Variable           | Purpose                                                                     |
| ------------------ | --------------------------------------------------------------------------- |
| `FIGMA_HOST`       | Figma REST API host. Default: `https://api.figma.com`.                      |
| `FIGMA_USER`       | Placeholder — Figma uses token-only auth. Kept for ENV symmetry.            |
| `FIGMA_PASS`       | **Required.** Figma Personal Access Token (sent as `X-Figma-Token`).        |
| `HTTPS_PROXY`      | Optional outbound HTTPS proxy URL.                                          |
| `HTTP_PROXY`       | Optional outbound HTTP proxy URL.                                           |
| `HTTP_PROXY_USER`  | Optional proxy username (when the proxy requires auth).                     |
| `HTTP_PROXY_PASS`  | Optional proxy password.                                                    |
| `NO_PROXY`         | Comma-separated host rules to bypass the proxy.                             |

### `proxy = {}` contract

Every entry point accepts a `proxy` option that follows the same
shape as the sibling `@polyglot/fetch-http-client` examples:

```ts
new FigmaClient({ token, proxy: {} })                 // auto-detect from HTTPS_PROXY / HTTP_PROXY
new FigmaClient({ token, proxy: { host: "http://p:3128" } })   // explicit host
new FigmaClient({ token, proxy: { host, user, pass } })        // full override
```

```py
FigmaClient(token=token, proxy={})                              # auto-detect
FigmaClient(token=token, proxy={"host": "http://p:3128"})
FigmaClient(token=token, proxy={"host": h, "user": u, "pass": p})
```

When no proxy is discoverable, the helper returns `undefined` / `None`
and the client omits the `proxy:` field — i.e. pass `proxy = {}`
safely without worrying about an empty host.

## Active plan

Implementation tracked under
`../AI-Agent-Plans/figma-api-fetchclient-polyglot-20260423-7d4e9f1a/`
(read-only). Task-level decomposition lives there; edits land in
`packages/{ts,py}/`, never in the plan tree.

## Examples

Runnable examples ship under each package's `examples/` tree:

| Surface  | TypeScript                                            | Python                                                  |
| -------- | ----------------------------------------------------- | ------------------------------------------------------- |
| SDK      | [`packages/ts/examples/sdk/`](packages/ts/examples/sdk/)     | [`packages/py/examples/sdk/`](packages/py/examples/sdk/)         |
| CLI      | [`packages/ts/examples/cli/`](packages/ts/examples/cli/)     | [`packages/py/examples/cli/`](packages/py/examples/cli/)         |
| API-shape | [`packages/ts/examples/api/`](packages/ts/examples/api/)   | [`packages/py/examples/api/`](packages/py/examples/api/)         |
| Servers  | [`packages/ts/examples/servers/`](packages/ts/examples/servers/) (Fastify) | [`packages/py/examples/servers/`](packages/py/examples/servers/) (FastAPI) |

### Server wiring patterns

This workspace ships the Figma client as **SDK-only**. The
`examples/servers/` trees show three reference wiring patterns per
runtime so you can drop the SDK into an existing HTTP service
without us making framework choices for you:

- **Fastify** — plugin (encapsulation) · lifecycle hooks · decorators.
- **FastAPI** — lifespan · dependency injection · middleware.

```bash
# TS
FIGMA_PASS=$FIGMA_TOKEN npx tsx packages/ts/examples/sdk/01-basic-usage.ts

# Python
FIGMA_PASS=$FIGMA_TOKEN python -m examples.sdk.basic_usage   # run from packages/py/
```

## Figma API coverage

All 8 domain sub-SDKs the plan specifies are implemented, covering
the 33 REST endpoints under `/v1/` + the v2 webhooks surface:

| Sub-SDK                  | Endpoints                                                           | Tier       |
| ------------------------ | ------------------------------------------------------------------- | ---------- |
| `me`                     | `GET /v1/me`                                                        | basic      |
| `files`                  | get / nodes / images / image-fills / meta / versions                | basic      |
| `comments`               | CRUD + reactions (list / add / remove)                              | basic      |
| `projects`               | team projects, project files                                        | basic      |
| `components`             | team + file + single: components / component_sets / styles          | basic      |
| `variables`              | local / published / post                                            | **enterprise** |
| `devResources`           | list / create / update / delete                                     | basic      |
| `libraryAnalytics`       | 6 actions/usages endpoints                                          | **enterprise** |
| `webhooks` (v2)          | create / get / update / delete / listForTeam / requests             | basic      |

Enterprise endpoints return `FigmaAuthError` (403) on non-enterprise
plans.

### Retry / backoff

By default the SDK installs Figma-sensible retry defaults
(3 attempts, 1s exponential backoff, retry on 429+5xx, respect
`Retry-After`). Callers can:

1. keep defaults — just construct the client;
2. disable inner retry with `retry: false` (Mode B: an outer
   `AsyncClient` owns retry);
3. tweak individual knobs — `retry: { maxRetries: 5 }` merges on top;
4. replace defaults verbatim — `forceOverwriteRetry: true` +
   `retry: {...}` opts out of Figma's presets entirely (feature flag).

## License

MIT.
