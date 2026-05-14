---
name: addon-author
scope: fastify_server
description: Scaffold a new TypeScript addon that plugs into the fastify_server bootstrap pipeline — correct signature, failure isolation, and LoaderReport shape.
triggers:
  - "write an addon"
  - "new bootstrap addon"
  - "custom loader"
  - "extend the pipeline"
---

# Skill — Author a TypeScript addon

## Pattern

```ts
// src/addons/my.addon.ts
import type { Addon } from "../registry/registry.js";
import { createLoaderReport, reportError } from "../contract/index.js";

export const myAddon: Addon = {
  name: "my-addon",
  priority: 40,
  async run(server, config, ctx) {
    const report = createLoaderReport("my-addon");
    try {
      // 1. discover (fs, env, remote)
      // 2. validate
      // 3. register via ctx.getAdapter().decorate(server, ...)
      //    OR ctx.registerInitHook / registerStartupHook / registerShutdownHook
    } catch (err) {
      reportError(report, "run", err);
    }
    return report;
  },
};

export default myAddon;
```

Then re-export it from `src/index.ts` **only** if it's meant to be public.

## Checklist before you ship it

- [ ] `name` is unique and matches the filename stem (kebab-case allowed in `name`, `kebab-case.addon.ts` for the file).
- [ ] `priority` is a sparse integer that doesn't collide with `10/20/30` (environment/lifecycle/route). Use 15, 25, 35, 40+ and document why.
- [ ] `run` catches every throw internally. The `Registry.runAll` fallback is a safety net, not a design.
- [ ] Every branch ends with an updated counter (`discovered`, `imported`, `skipped`, `registered`) or a `reportError(...)` entry.
- [ ] `report.errors[].step` is one of: `"discover" | "import" | "shape" | "register" | "run"`.
- [ ] Use `ctx.logger.debug/info/warn/error` for bootstrap logs, `server.log` (pino) only for Fastify-level logs.
- [ ] Read paths from `config.paths.<key>` — they're already absolute.
- [ ] If your addon scans a directory, use `readdir({ withFileTypes: true })` and `sortByNumericPrefix(...)` for deterministic ordering. Dynamic imports go through `pathToFileURL(file).href`.
- [ ] Handle `ENOENT` / `ENOTDIR` from `readdir` as "empty directory", not as an error.
- [ ] Import peers with `.js` specifiers (NodeNext): `from "../contract/index.js"`, not `"../contract"`.
- [ ] Add a test under `test/` asserting: (a) returns a `LoaderReport`, (b) increments the right counters, (c) a thrown error in the body lands in `report.errors`.

## Anti-patterns

- Throwing out of `run` (breaks the pipeline contract; registry will overwrite your report).
- Building a report object by hand (`{ name, discovered: 0, ... }`) — use `createLoaderReport`.
- Writing `process.env` in `run` (that's what `environmentAddon` is for).
- Using priorities like `0`, `100`, `1000` — leaves no room between addons.
- Wrapping `run` in `Promise.resolve().then(...)` — just mark it `async`.
- Importing with extensionless specifiers — TypeScript's NodeNext module mode requires the `.js` suffix.
