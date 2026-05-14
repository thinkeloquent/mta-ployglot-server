# Integration Scenario 01 — Fastify Addon

## Goal

Show how a `@ployglot/fastify-server` consumer registers an addon that
initializes the vault-file env store during the server's `onInit` phase.

## Addon signature

The addon module lives at `examples/integration/fixtures/envStoreAddon.mjs`.
It conforms to the `fastify_server/.agents/addon-author.md` contract — takes
a `ctx` with `report` / `app` and returns a `LoaderReport`. Nothing in this
example imports from the `@ployglot/fastify-server` package; the
signature is vendored so the workspace has no cross-repo dependency.

```js
import { envStoreAddon } from './fixtures/envStoreAddon.mjs';

// In the consumer's bootstrap config:
export default {
  addons: [envStoreAddon],
};
```

## Runtime config

- `VAULT_ENV_PATH` — path to the `.env` file. Defaults to `.env` at the CWD.
- `LoaderReport.info` logs the loaded var count.
- Failure path: `EnvStore.onStartup` error → `report.fail({ addon, message })`
  — the bootstrap loader downgrades the overall health to `degraded` by
  default (consumers can opt into hard-fail via the bootstrap settings).

## Expected `LoaderReport` shape

Success:

```json
{ "addon": "envStore", "totalVarsLoaded": 45 }
```

Failure:

```json
{ "addon": "envStore", "message": "Environment file path is required" }
```

## Notes

- Addon runs exactly once per process, during `onInit`. Do not register it
  as a request handler.
- If `VAULT_ENV_PATH` is set but the file is missing, the addon succeeds
  with the `process.env`-only var count and logs a warning through the
  bootstrap's `report.info` sink.
