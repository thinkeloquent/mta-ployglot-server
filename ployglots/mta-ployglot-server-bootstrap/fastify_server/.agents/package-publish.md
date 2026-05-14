---
name: package-publish
scope: fastify_server
description: Update package.json and tsconfig.json for an npm release of @ployglot/fastify-server. Do NOT run publish commands — scaffold a Makefile.publish for the user instead.
triggers:
  - "release"
  - "publish to npm"
  - "bump version"
  - "package.json"
  - "npm publish"
---

# Skill — Prepare an npm release (TS side)

> **Do not run publish commands.** Per project memory: scaffold `Makefile.publish` targets and let the user trigger them.

## The publishable surface

`package.json` controls what ends up in the tarball.

```json
{
  "name": "@ployglot/fastify-server",
  "version": "X.Y.Z",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
    "./adapters/fastify":    { "types": "./dist/adapters/fastify.adapter.d.ts", "import": "./dist/adapters/fastify.adapter.js" },
    "./addons/environment":  { "types": "./dist/addons/environment.addon.d.ts", "import": "./dist/addons/environment.addon.js" },
    "./addons/lifecycle":    { "types": "./dist/addons/lifecycle.addon.d.ts", "import": "./dist/addons/lifecycle.addon.js" },
    "./addons/route":        { "types": "./dist/addons/route.addon.d.ts", "import": "./dist/addons/route.addon.js" },
    "./contracts/*.json":    "./contracts/*.json"
  },
  "files": ["dist", "contracts", "README.md", "LICENSE"],
  "engines": { "node": ">=20" }
}
```

Critical invariants:

1. **Ship compiled output only.** `files` allowlists `dist/`, `contracts/`, `README.md`, `LICENSE`. Source `src/` does **not** ship.
2. **`dist/` is produced by `npm run build` (`tsc -p .`).** Always `npm run clean && npm run build` before `npm pack`.
3. **Contracts ship alongside dist.** The `exports["./contracts/*.json"]` mapping + `"contracts"` in `files` lets consumers do `import schema from "@ployglot/fastify-server/contracts/bootstrap.schema.json" with { type: "json" }`.
4. **Every subpath export must exist in `dist/`.** If you add `./addons/foo`, the compiled `dist/addons/foo.addon.js` must exist or `npm install` will warn consumers.
5. **No `file:` or `workspace:` dependencies.** npm rejects them. Use published versions.
6. **`"type": "module"`** — the package is ESM. Don't downgrade.

## Pre-release checklist (no publish yet)

- [ ] `version` bumped in `package.json` (semver — see `contract-parity` skill for when to go major).
- [ ] `npm run clean && npm run build` succeeds; `dist/` populated.
- [ ] `npm test` green (parity, contract, registry tests).
- [ ] `npm pack --dry-run` output inspected — every file on the expected list, nothing surprising.
- [ ] Contracts present in the tarball: `npm pack --dry-run 2>&1 | grep contracts` shows the three JSON files.
- [ ] `exports` map entries all resolve to real files in `dist/`.
- [ ] Scratch install in a fresh dir: `npm pack && cd /tmp/new && npm init -y && npm install /abs/path/to/fastify-server-X.Y.Z.tgz && node -e "import('@ployglot/fastify-server').then(m => console.log(Object.keys(m)))"`.

Delegate the tarball and scratch install to the `audit-registry-publishability` agent if the package hasn't shipped before or layout changed.

## Makefile.publish targets to scaffold (don't run)

```makefile
# Makefile.publish — user runs these manually.
.PHONY: build pack publish-dry publish

build:
\tnpm run clean
\tnpm run build

pack: build
\tnpm pack

publish-dry: build
\tnpm publish --dry-run --access public

publish: build
\tnpm publish --access public
```

Use tabs in Make recipes. The user invokes `make -f Makefile.publish publish-dry` → `make -f Makefile.publish publish`.

## Anti-patterns

- Running `npm publish` yourself. User triggers, not the agent.
- Shipping `src/` (remove from `files` allowlist; keep it `["dist", "contracts", ...]`).
- Adding a new `exports` subpath without a matching compiled file in `dist/`.
- Removing `"./contracts/*.json"` from `exports` — breaks consumers that read the schema at runtime.
- Changing `"type"` to `"commonjs"` — the whole package targets ESM.
- Publishing without running `npm run build` first — you'll ship a stale `dist/`.
