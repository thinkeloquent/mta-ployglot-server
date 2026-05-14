# fetch-http-client (polyglot workspace)

Workspace root for `@polyglot/fetch-http-client` — async HTTP client for Node.js
on top of [`undici`](https://github.com/nodejs/undici), with auth, retry,
circuit breaker, response caching, streaming, and an SDK facade. API-compatible
with `fetch-httpx`.

## Packages

| Package                              | Description                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------- |
| [`packages/ts/`](packages/ts/)       | `@polyglot/fetch-http-client` — TypeScript implementation. ESM, Node ≥ 18.            |
| [`packages/py/`](packages/py/)       | `polyglot-fetch-http-client` — Python twin on top of `httpx`. Python ≥ 3.11.          |
| [`packages/ts-py/`](packages/ts-py/) | Earlier `@mta/fetch-httpx` exploration. Reference only — not in workspaces.           |

## Active plan

Implementation tracked under
[`../AI-Agent-Plans/fetch-http-client-ts-20260422-b8d2e4f1/`](../AI-Agent-Plans/fetch-http-client-ts-20260422-b8d2e4f1/)
(read-only; edits land in `packages/ts/`, not in the plan tree).

## Quickstart

```bash
# TypeScript side
make -C packages/ts ci             # ci-install → lint → test → build
make -C packages/ts help           # list available targets
make -C packages/ts test-integration   # live-provider tests (env-gated)

# Python side
make -C packages/py ci             # ci-install → lint → test
make -C packages/py help           # list available targets
make -C packages/py test-integration   # live-provider tests (env-gated)
```

## Examples

Six runnable provider integrations ship in both packages under
`examples/integrations/`: JIRA, Confluence, GitHub, Figma, Statsig, Sauce
Labs. Each follows the `<SERVICE>_HOST/USER/PASS` env contract and accepts
an optional `proxy = {}` placeholder that auto-detects from `HTTPS_PROXY` /
`HTTP_PROXY`. See:

- TypeScript: [`packages/ts/examples/README.md`](packages/ts/examples/README.md)
- Python: [`packages/py/examples/README.md`](packages/py/examples/README.md)

```bash
# TS
JIRA_HOST=https://acme.atlassian.net JIRA_USER=you@acme.com JIRA_PASS=$TOKEN \
  npx tsx packages/ts/examples/integrations/jira.ts

# Python
JIRA_HOST=https://acme.atlassian.net JIRA_USER=you@acme.com JIRA_PASS=$TOKEN \
  python -m examples.integrations.jira     # run from packages/py/
```
