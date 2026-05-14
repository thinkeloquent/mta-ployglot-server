# mta-ployglot-pkg-app-yaml-config

Polyglot read-only configuration store on top of `app-yaml-loader`'s output. Owns deep-merge, `global → providers` propagation, the typed query surface, and immutable mutator stubs.

## Packages

| Package | Language | Path |
| ------- | -------- | ---- |
| `@ployglot/app-yaml-config` | Node ESM (raw `.mjs`) | [`packages/mjs/`](packages/mjs/) |
| `app_yaml_config` | Python ≥ 3.11 (hatchling) | [`packages/py/`](packages/py/) |

## Plan

Authoritative implementation plan: `../AI-Agent-Plans/18/app-yaml-config-20260427-c2d18a5b/` (relative to siblings of this repo).

## Examples

Runnable docs under [`examples/`](examples/) — `sdk/` for embedding, `api/` for surface contract.

## Quickstart

```bash
cd packages/mjs && make ci
cd packages/py  && make ci
```
