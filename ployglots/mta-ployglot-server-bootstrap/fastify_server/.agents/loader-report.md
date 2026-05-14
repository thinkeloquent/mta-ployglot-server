---
name: loader-report
scope: fastify_server
description: Build, mutate, and assert on LoaderReport instances. The canonical result shape every addon must return.
triggers:
  - "loader report"
  - "LoaderReport"
  - "report.errors"
  - "reportError"
---

# Skill — LoaderReport

## Shape (normative: `contracts/loader.schema.json`)

```ts
interface LoaderReportError {
  step: "discover" | "import" | "shape" | "register" | "run" | string;
  error: string;    // "Name: message"
  path?: string;    // file or directory involved, if any
}

interface LoaderReport {
  name: string;
  discovered: number;   // items found by scanning
  validated: number;    // passed cheap structural checks
  imported: number;     // successfully loaded / parsed
  registered: number;   // fully attached to the server/context
  skipped: number;      // intentionally ignored (shape mismatch, flag off)
  errors: LoaderReportError[];
  details?: Record<string, unknown>;  // free-form per-addon
}
```

## Always construct via helpers

```ts
import { createLoaderReport, reportError } from "../contract/index.js";

const report = createLoaderReport("my-addon");   // name set, counters zeroed, errors=[]
// ...
reportError(report, "import", err, file);         // appends a normalized error entry
```

Never build the object by hand. `reportError` normalizes `unknown` → `"Name: message"`, so you can pass any `catch (err)` directly.

## Counter invariants

| Counter | Meaning | Never-subtract rule |
| --- | --- | --- |
| `discovered` | How many candidates did I see? | Monotonic per run. |
| `validated`  | How many passed pre-import checks? | `≤ discovered`. |
| `imported`   | How many loaded without error? | `≤ validated + discovered`. |
| `registered` | How many actually attached to the server/ctx? | `≤ imported`. |
| `skipped`    | Imported but not registered (shape wrong, disabled, etc.). | `discovered >= registered + skipped - imported` holds informally. |

If you're tempted to decrement a counter, you're modelling the flow wrong — revisit it.

## Error step vocabulary

Use the smallest verb that fits:

- `discover` — `readdir` failure that isn't `ENOENT`/`ENOTDIR`, remote index lookup failed.
- `import`   — `import(pathToFileURL(file).href)` threw.
- `shape`    — import succeeded, but the exported surface was wrong (no `default`/`mount`, not a function, etc.).
- `register` — shape was fine, but attaching to the server threw.
- `run`      — catch-all for unexpected exceptions from the addon body. The `Registry` fallback uses this too.

## Asserting in tests

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { myAddon } from "../src/addons/my.addon.js";

test("myAddon happy path", async () => {
  const report = await myAddon.run(fakeServer, fakeConfig, fakeCtx);
  assert.equal(report.name, "my-addon");
  assert.deepEqual(report.errors, []);
  assert.equal(report.registered, 1);
  assert.ok(report.discovered >= report.registered);
});
```

For failure paths, assert structure — not the exact message:

```ts
assert.equal(report.errors.length, 1);
assert.equal(report.errors[0].step, "import");
assert.match(report.errors[0].error, /ReferenceError/);
```

## Anti-patterns

- Emitting `console.log(...)` / `server.log.warn(...)` *instead of* `reportError` — telemetry disappears.
- Mixing counter semantics (e.g. `registered` for "found" things you haven't attached).
- Free-form `step` strings like `"oops"`, `"fail"`. Use the vocabulary above.
- Mutating `report` after it has been returned from `run`.
- Swallowing `ENOENT` via a blanket `try/catch(_){}` — the shipped addons narrow by `code` precisely so other errors still land as `discover` entries.
