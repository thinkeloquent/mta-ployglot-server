---
name: esm-nodenext
scope: fastify_server
description: Rules for ESM + TypeScript NodeNext in this package — the .js import-specifier rule, node: imports, dynamic import via pathToFileURL.
triggers:
  - "import specifier"
  - "ERR_MODULE_NOT_FOUND"
  - "cannot find module"
  - "nodenext"
  - "module resolution"
  - ".js extension"
---

# Skill — ESM + NodeNext in `fastify_server`

`tsconfig.json` is `module: "NodeNext"` and `package.json` is `"type": "module"`. That combination has three non-obvious rules that trip up new contributors.

## Rule 1 — TS sources import peers with a `.js` specifier

Even though the source file is `foo.ts`, you write:

```ts
import { setup } from "../core/index.js";   // ✅
import { setup } from "../core/index";      // ❌ fails compilation under NodeNext
import { setup } from "../core/index.ts";   // ❌ wrong extension
```

This is because NodeNext matches Node's ESM resolver, which requires the literal extension *as it will exist at runtime* (i.e. after `tsc` emits `.js`).

Apply this to **every** local import in `src/`:

- `"./types.js"` not `"./types"`.
- `"../contract/index.js"` not `"../contract"`.
- `"../addons/route.addon.js"` not `"../addons/route.addon"`.

## Rule 2 — Use `node:` protocol for built-ins

```ts
import { readdir } from "node:fs/promises";   // ✅
import { readdir } from "fs/promises";        // ❌ resolves differently, subject to shadowing
import { join } from "node:path";             // ✅
import { pathToFileURL } from "node:url";     // ✅
```

The `node:` prefix is the canonical form in modern ESM and avoids name collisions with unscoped npm packages.

## Rule 3 — Dynamic `import()` needs a file URL, not a path

The loader addons import user files at runtime. They **must** convert the path first:

```ts
import { pathToFileURL } from "node:url";

const mod = await import(pathToFileURL(absoluteFile).href);   // ✅
const mod = await import(absoluteFile);                        // ❌ ERR_INVALID_URL on Windows, unreliable on POSIX
```

This is how every built-in addon (`environment`, `lifecycle`, `route`) loads user code — don't deviate.

## Package-level knobs you should know

- `"type": "module"` in `package.json` — tells Node all `.js` files are ESM. Don't change.
- `"exports"` map in `package.json` — consumers can only see what's listed. Adding a new public surface means adding an `exports` entry AND a compiled file in `dist/`.
- `dist/` is what ships. All `.js` files in `dist/` end up ESM because of `"type": "module"`. TypeScript writes them with the correct relative specifiers because you followed Rule 1.

## Common failure modes and fixes

| Symptom | Cause | Fix |
| --- | --- | --- |
| `TS2307: Cannot find module '../foo'` under NodeNext | Missing `.js` | Add `.js`: `'../foo.js'`. |
| `ERR_MODULE_NOT_FOUND` at runtime for a consumer | `exports` map doesn't include the path | Add the subpath to `exports` AND ensure the compiled `.js`/`.d.ts` exist in `dist/`. |
| `ERR_INVALID_URL` when loading a user file | Dynamic `import(path)` on a POSIX path containing special chars, or Windows backslashes | `import(pathToFileURL(path).href)`. |
| Consumer error: `Must use import to load ES Module` | A CJS consumer tried to `require()` us | Tell them to use `import()` or switch to ESM. The package is ESM-only by design. |
| Test runner can't find TS files | `node --test` alone won't transpile | Use `node --test --import tsx test/*.test.ts` (see `package.json:scripts.test`). |

## Anti-patterns

- Deleting the `.js` suffix because your editor grays it out. It's required at runtime.
- Adding `"moduleResolution": "node"` or `"module": "esnext"` to `tsconfig.json`. Keep NodeNext.
- Wrapping `await import(...)` in a `try { require(...) } catch { ... }` fallback. Don't add CJS paths.
- Writing `.cjs` files in `src/` — if you need CJS for a consumer, open a discussion first.
