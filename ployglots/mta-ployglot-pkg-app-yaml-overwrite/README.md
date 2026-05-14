# mta-ployglot-pkg-app-yaml-overwrite

Polyglot package implementing **YAML-overwrite resolution** as two decoupled-but-paired
layers, each independently usable and independently published.

| Layer    | mjs                                                                  | py                                                                |
| -------- | -------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Engine   | [`packages/engine-mjs/`](packages/engine-mjs) — `@ployglot/runtime-template-resolver` | [`packages/engine-py/`](packages/engine-py) — `runtime_template_resolver` |
| Applier  | [`packages/applier-mjs/`](packages/applier-mjs) — `@ployglot/app-yaml-from-context`   | [`packages/applier-py/`](packages/applier-py) — `app_yaml_from_context`   |

- **Engine** — `ContextResolver` + `ComputeRegistry`. Recognises `{{path}}`, `{{fn:NAME}}`,
  `{{env.VAR}}` patterns. Stateless. Standalone-usable on any string.
- **Applier** — Tree walker. Finds `overwrite_from_context` / `overwrite_from_env`
  sections, asks an injected engine to resolve any templates inside them, then merges
  with **null-replace** semantics. Standalone-usable on any object tree.

## Active plan

Implementation is driven by the plan tree at
`../AI-Agent-Plans/18/app-yaml-overwrite-20260427-9f4a76d8/`.

## Sibling dependencies

- **`env-resolve`** — `{{env.VAR}}` resolution backs onto the sibling package at
  `../mta-ployglot-pkg-env-resolve/`. The engine declares it as a hard runtime dep.

## Quick start

```bash
# Node side — install workspace + run all mjs tests
npm install
npm test

# Python side — sync uv workspace + run all py tests
uv sync
uv run pytest packages/engine-py/tests packages/applier-py/tests

# Per-package CI
make -C packages/engine-mjs ci
make -C packages/engine-py ci
make -C packages/applier-mjs ci
make -C packages/applier-py ci
```

See [`examples/`](examples/) for runnable SDK + API contracts.
