---
name: twin parity & drift catalog
description: Cross-reference of intentional drift between the TypeScript and Python twins of fetch-http-client. Pulled from each package's `.agent.md` "Parity Notes" section.
type: cross-cutting
scope: root
---

# Twin parity — `fetch-http-client` (TS ↔ PY)

This repo ships **one logical package in two languages**. The TS implementation is the lead; the Python twin mirrors surface, defaults, and examples. `snake_case` vs `camelCase` is the main idiomatic delta.

Source of truth for each bullet lives in the per-package doc:
- TS: [`../packages/ts/.agent.md`](../packages/ts/.agent.md) (§ Parity with the Python twin)
- PY: [`../packages/py/.agent.md`](../packages/py/.agent.md) (§ Parity with the TypeScript twin)

## Enforced parity (must stay aligned)

| Contract | TS form | PY form |
| --- | --- | --- |
| Auth class names | `BasicAuth`, `BearerAuth`, `APIKeyAuth`, `DigestAuth`, `NoAuth` | `BasicAuth`, `BearerAuth`, `APIKeyAuth`, `DigestAuth` |
| Timeout phases | `connect` / `read` / `write` / `pool`, `DEFAULT_LLM_TIMEOUT` | same |
| Jitter strategies | `NONE` / `FULL` / `EQUAL` / `DECORRELATED` | same |
| Circuit-breaker states | `CLOSED` / `OPEN` / `HALF_OPEN` | same |
| Idempotent retry set | `GET`/`HEAD`/`OPTIONS`/`TRACE`/`PUT`/`DELETE`; never `POST`/`PATCH` | same |
| Cacheable set (RFC 7234-ish) | `GET`/`HEAD` + status ∈ `{200, 203, 300, 301, 404, 410}` | same |
| Integration examples | JIRA, Confluence, GitHub, Figma, Statsig, Sauce Labs | same 6 |
| Env contract for examples | `<SERVICE>_HOST`/`USER`/`PASS` | same |
| Proxy placeholder | `proxy = {}` → auto-detect from `HTTPS_PROXY`/`HTTP_PROXY`, honors `NO_PROXY` | `proxy={}` → same |
| Logger env | `LOG_LEVEL`, `LOG_FORMAT` | same (+ `PYTHON_ENV` vs `NODE_ENV`) |
| Makefile targets | `help` / `ci` / `test` / `test-integration` / `build` / `clean` / `distclean` | same |

## Intentional drift

| Area | TS | PY | Rationale / tracking |
| --- | --- | --- | --- |
| Case convention | `camelCase` — `raiseForStatus`, `followRedirects` | `snake_case` — `raise_for_status`, `follow_redirects` | Idiomatic per language; do not "align" |
| Streaming primitives | Ships `iterBytes`, `iterText`, `iterLines`, `iterNDJSON`, `iterSSE` | `Response` reads full body today; streaming deferred | Python streaming is a follow-up; not yet scheduled |
| SDK facade | `SDK`, `CLIContext`, `AgentHTTPClient`, `PoolClient` under `@polyglot/fetch-http-client/sdk` | `fetch_httpx_async` + module-level verbs only | Full facade planned follow-up |
| Framework adapter | Fastify adapter — deferred | FastAPI adapter — deferred | Both tracked under plan feature 13; land together |
| Env var (dev vs prod) | `NODE_ENV` | `PYTHON_ENV` | Each language's idiomatic knob |
| Transport | `undici` (peer, `^7.19.0`) | `httpx >= 0.27` | Each language's best-in-class async HTTP |
| Sync client | none | none | Both async-only by design |

## Parity workflow

When touching a parity-sensitive surface:

1. Read both `.agent.md` parity sections before editing.
2. Land the change on the lead (TS) first when feasible.
3. Mirror to the twin in the same PR or an immediate follow-up — don't let drift accumulate silently.
4. If new drift is intentional, add a row to the table above in the same change.
5. Before release, run the `sdk-polyglot-parity-auditor` agent to catch unrecorded drift.
