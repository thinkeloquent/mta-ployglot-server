---
name: lifecycle-hook
scope: fastify_server
description: Write `onInit` / `onStartup` / `onShutdown` modules that the lifecycleAddon will pick up and wire into Fastify's hook system.
triggers:
  - "lifecycle hook"
  - "onStartup"
  - "onShutdown"
  - "onInit"
  - "startup hook"
  - "shutdown hook"
---

# Skill — Author a lifecycle module

## What the loader expects

`lifecycleAddon` scans `config.paths.lifecycles/` for files ending in `.lifecycle.mjs` or `.lifecycle.js` and looks for these named exports (or the same names on a default-exported object):

| Export | Runs when | Errors | Typical use |
| --- | --- | --- | --- |
| `onInit(server, config)`     | **Once**, inline during `setup()`. Sync OR async. | Logged, NOT thrown | Decorate the server, set up instance-level state |
| `onStartup(server, config)`  | On Fastify `onReady` (right before `listen` resolves). | Logged, NOT thrown | Warm caches, open connections, emit "ready" events |
| `onShutdown(server, config)` | On Fastify `onClose`. Triggered by `close-with-grace` on SIGTERM/SIGINT. | Logged, NOT thrown | Drain queues, flush buffers, close DB clients |

A module can export any subset. If it exports none, the addon counts it as `skipped`.

## Template

```js
// config/lifecycles/20_db.lifecycle.mjs
export function onInit(server, config) {
  server.decorate("dbDsn", config.extra?.db_dsn ?? "postgres://localhost/app");
  server.log.info({ dsn: server.dbDsn }, "db dsn resolved");
}

export async function onStartup(server) {
  server.decorate("db", await connectPool(server.dbDsn));
  server.log.info("db pool opened");
}

export async function onShutdown(server) {
  if (server.db) {
    await server.db.close();
    server.log.info("db pool closed");
  }
}

async function connectPool(dsn) { /* ... */ }
```

## Rules

1. **Signature is `(server, config)`** — even when you don't use one, accept both. Fine to name them `_server` / `_config`.
2. **Sync or async** — both are fine. The adapter `await`s them in order.
3. **`onInit` is the only phase that runs inline during `setup()`.** Throwing from `onInit` is still logged (not rethrown), so if you truly need to fail boot, do it from an addon instead.
4. **Use `server.decorate(key, value)` for instance state** — not `server[key] = value`. Fastify tracks decorators.
5. **Use `server.decorateRequest(key, null)` + an `onRequest` hook** if you need per-request state. The built-in `attachRequestState` path handles `config.initial_state` already.
6. **Don't register routes from a lifecycle file.** That's `routeAddon`'s job.
7. **Ordering** — prefix with `10_`, `20_`. `sortByNumericPrefix` runs before import.
8. **Don't do heavy work at module-level.** The loader `import()`s the file for its hooks, not for side effects.

## Testing standalone

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { onStartup } from "../config/lifecycles/20_db.lifecycle.mjs";

test("onStartup opens pool", async () => {
  const server = Fastify({ logger: false });
  server.decorate("dbDsn", "postgres://test/db");
  await onStartup(server, { /* resolved config */ });
  assert.ok(server.db);
  await server.close();
});
```

## Anti-patterns

- Throwing to "cancel" boot — throws are logged, not rethrown. Use `onInit` + addon validation if you need a hard stop.
- Starting background timers without `server.addHook("onClose", clearInterval...)`.
- Relying on import side effects (`import "./something.js"` at the top that mutates globals) — `environment.addon` is the right place for that.
- Calling `process.exit(...)` inside a hook.
