# `server/parity/` — cross-runtime parity harness

This folder is a small Node-based test driver that boots both server runtimes (Fastify + FastAPI) side-by-side against a shared mock origin, hits the same endpoints on each, and emits a structural diff of their JSON responses. It is the executable contract that keeps the mjs ↔ py twins from drifting.

It does **not** belong to either runtime. It sits as a peer to `server/fastify/` and `server/fastapi/` because both runtimes are equal participants — `_diff.mjs` reports `missing on fastify` and `missing on fastapi` symmetrically, and `run_parity.mjs` boots Fastify in-process and FastAPI as a `poetry run python main.py` subprocess from the same orchestrator.

## What gets compared

Defined in `_drivers.mjs` as the `ENDPOINTS` table.

**Six provider healthz probes** — exercise the per-provider `AsyncClient` factories and the `BearerAuth` / `BasicAuth` / `APIKeyAuth` mapping resolved from `server.dev.yaml`'s `providers.<name>` block:

- `/healthz/integrations/jira/myself`
- `/healthz/integrations/wiki/rest/api/user/current` (Confluence — note the `/wiki` prefix that the Confluence factory strips before composing the client)
- `/healthz/integrations/github/user`
- `/healthz/integrations/figma/me`
- `/healthz/integrations/statsig/gates`
- `/healthz/integrations/saucelabs/rest/v1/user`

**Four app-yaml pipeline stage endpoints** — exercise the 5-stage config pipeline (loader → merge → applier → fetch SDK loadConfig → live derivations):

- `/healthz/app-yaml-stage/raw`
- `/healthz/app-yaml-stage/merged`
- `/healthz/app-yaml-stage/applied`
- `/healthz/app-yaml-stage/derived`

## How it works

1. **Start the mock origin** (`startMock` from `../fastify/tests/integrations/_mock_origin.mjs`). One process, one port, plays the role of every upstream provider.
2. **Boot both runtimes** pointed at the mock:
   - Fastify: `bootInProcess` from `../fastify/tests/integrations/_boot.mjs` (in-process, fast).
   - FastAPI: `spawn("poetry", ["run", "python", "main.py"], …)` with a random port in `52900–52999`, then poll `/healthz` until ready (50 × 200ms).
3. **Drive every endpoint on both** via `fetchOne`, in parallel per endpoint pair.
4. **Diff** with `structuralDiff` from `_diff.mjs` — recursive, type-aware, emits one line per discrepancy as `$.path.to.field: <a> vs <b>`. Status-code mismatches short-circuit the body diff for that endpoint.
5. **Tear down** Fastify (close), FastAPI (`SIGTERM`), and the mock — always in `finally`.

Exit code is `0` if `diffs.length === 0`, otherwise `1` with every diff printed to stderr.

### Normalizers

Two endpoint-level normalizers strip *intentional* differences before diffing, defined inline in `_drivers.mjs`:

- `normalizeProvider` — drops the response-body `host` field. By design, `host` echoes `cfg.providers.<name>.base_url`, which is byte-equal across runtimes, but tests configure base URLs via env templating and we don't want to assert on host-specific URL bytes.
- `normalizeRawStage` — the `raw` pipeline stage keys its `data` object by absolute file paths, which differ between runtimes (`.dev/fastify-app/config/...` vs `.dev/fastapi/config/...`). The normalizer reduces each key to its basename so the diff compares config files by name, not by host path.

If you ever need to mark a known drift as tolerated rather than normalized away, `_diff.mjs` exports `applyTolerances(diffs, toleratedSet)` for that purpose.

## Shared env

`runParity` injects a fixed env into both runtimes so every provider points at the mock with stable credentials:

```
JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN
CONFLUENCE_BASE_URL, CONFLUENCE_EMAIL, CONFLUENCE_API_TOKEN
GITHUB_API_BASE_URL, GITHUB_TOKEN
FIGMA_API_BASE_URL, FIGMA_TOKEN
STATSIG_BASE_URL, STATSIG_API_KEY
SAUCELABS_BASE_URL, SAUCE_USERNAME, SAUCE_ACCESS_KEY
```

These names are the canonical provider env keys referenced from `server.dev.yaml`'s `{{env.X}}` templates — keep them aligned with the smoke fixture's `PROVIDER_ENV` table and the per-provider unit tests.

## Running

```sh
# From this folder:
make ci

# Or directly:
node run_parity.mjs
```

Exit code: `0` on parity, `1` on drift (one line per diff to stderr).

The Makefile target is also reachable from the repo root via `make -f Makefile.servers-ci ci-parity`, which is the entry point CI uses.

## Files

| File | Purpose |
| --- | --- |
| `run_parity.mjs` | Orchestrator. Boots mock + both runtimes, runs the diff, tears down. CLI entry. |
| `_drivers.mjs` | `ENDPOINTS` table and `fetchOne(baseUrl, endpoint)`. Owns the per-endpoint normalizers. |
| `_diff.mjs` | `structuralDiff(a, b, path)` + `applyTolerances(diffs, toleratedSet)`. Pure functions, no I/O. |
| `Makefile` | One target — `make ci` → `node run_parity.mjs`. |
| `package.json` | `type: "module"`, no deps. The package only exists so Node treats `.mjs` files here as ESM. |

## Adding a new endpoint

1. Implement the endpoint on **both** runtimes (`server/fastify/...` + `server/fastapi/...`). If responses include a per-runtime field that should not be diffed, plan a normalizer.
2. Append a row to `ENDPOINTS` in `_drivers.mjs`:
   ```js
   { name: "myprovider", url: "/healthz/integrations/myprovider/me", normalize: normalizeProvider },
   ```
3. If the new endpoint needs upstream-credential env, append the keys to the `env` block in `run_parity.mjs`.
4. Run `make ci`. A green run is the new contract.

## Adding a new provider (related)

Per the project's provider-config convention, parity is the third of three edits:

1. `providers.<name>` in `server.dev.yaml` (with `endpoint_auth_type` + tokens via `{{fn:provider_api_keys.<name>}}` + `base_url` via `{{env.X | 'default'}}`).
2. `make_<name>_client` in **both** `server/{fastapi,fastify}/config/lifecycles/_fetch_factories.{py,mjs}` (≤8 lines each).
3. Row in `tests/unit/test_fetch_factory_parity.{py,mjs}` `_FAKE_CFG` + `_EXPECTED`.
4. Endpoint row in this folder's `_drivers.mjs` (per the section above).

Step 3 catches yaml↔factory drift unit-test fast; step 4 catches HTTP-surface drift integration-test slow. Both gates must pass before release.

## Why not put this inside `server/fastify/` or `server/fastapi/`

Because the harness is *about* both runtimes, not owned by either one. Burying it under one side would imply that side is canonical and the other is being checked against it — the exact asymmetry parity exists to reject. The diff is symmetric (`missing on fastify` / `missing on fastapi`), the boot is symmetric (in-process fastify + subprocess fastapi), and the toolchain is neutral (its own tiny ESM package, not part of either runtime's vitest/pytest suite).

The closest analogue is `tests/unit/test_fetch_factory_parity.{py,mjs}` — that one is a *per-runtime* unit test of factory composition and correctly lives inside each runtime's `tests/`. This folder is the *cross-runtime* HTTP-level test, one layer up because it owns the live boot of both.
