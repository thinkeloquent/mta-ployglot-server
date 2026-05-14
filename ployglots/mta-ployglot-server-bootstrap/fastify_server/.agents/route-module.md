---
name: route-module
scope: fastify_server
description: Write a *.routes.mjs module that the built-in routeAddon will discover and register as a Fastify plugin.
triggers:
  - "routes file"
  - "register routes"
  - "fastify plugin"
  - "route module"
---

# Skill — Route module

## What the loader expects

`routeAddon` (priority 30) scans `config.paths.routes/` for files ending in `.routes.mjs` or `.routes.js`. It dynamic-`import()`s each, then takes:

1. `module.default`
2. `module.mount`

…whichever is a `function`. The callable is registered as a Fastify plugin:

```ts
await server.register(async (scope) => {
  await fn(scope, (server as unknown as { _config: BootstrapConfig })._config);
});
```

So your function runs inside its **own Fastify scope** (encapsulation), with a `config` arg containing the user-facing `BootstrapConfig` (not the resolved one — decorated on `server._config` by the orchestrator).

If neither `default` nor `mount` is a function, the module is `skipped` with a `"shape"` error.

## Template (recommended)

```js
// config/routes/10_healthz.routes.mjs
export default async function healthzRoutes(fastify, config) {
  fastify.get("/healthz", async () => ({
    status: "ok",
    service: config.title,
    profile: config.profile,
    build_id: process.env.BUILD_ID,
  }));

  fastify.get("/_reports", async () => fastify._loaderReports);
}
```

## Alternative: named `mount` export

```js
export async function mount(fastify, config) {
  fastify.get("/metrics", async () => ({ ok: true }));
}
```

Both forms work. Prefer `default` for terseness unless the file exports other utilities.

## Rules

1. **Signature is `(fastify, config) => void | Promise<void>`.** The `fastify` arg is an **encapsulated** scope — hooks/decorators here don't leak to siblings. This is intentional.
2. **Return `undefined`** (or a Promise that resolves to undefined). Don't return a router object — Fastify doesn't have one.
3. **Use `config.title`, `config.profile`, `config.extra.*` for settings.** Don't reach into `process.env` unless the setting is genuinely environmental (e.g. `BUILD_ID`).
4. **Use `server._loaderReports`** (decorated by the orchestrator) to expose addon diagnostics.
5. **Prefix filenames** (`01_`, `10_`, `20_`) — `sortByNumericPrefix` runs before import.
6. **Don't register Fastify-level hooks** (`onClose`, `onReady`) from route files — use `*.lifecycle.mjs`.
7. **Don't call `fastify.listen(...)`** — only the entrypoint does that.
8. **Async is fine and preferred.** The adapter awaits the plugin registration.

## Testing standalone

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import healthzRoutes from "../config/routes/10_healthz.routes.mjs";

test("/healthz", async () => {
  const server = Fastify({ logger: false });
  await server.register(async (scope) => healthzRoutes(scope, { title: "svc", profile: "test" }));
  const res = await server.inject({ method: "GET", url: "/healthz" });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().service, "svc");
  await server.close();
});
```

## Anti-patterns

- Exporting a plain object (e.g. `{ routes: [...] }`) — the loader expects a function.
- Using CommonJS (`module.exports = ...`) — the package is ESM; use `export default`.
- Mutating the outer `server` (the one passed to `setup`) — you'll get the scoped one. If you truly need the root server, restructure as a lifecycle hook.
- Importing the built `dist/` from a user route file — import from `@ployglot/fastify-server` or don't import the package at all.
