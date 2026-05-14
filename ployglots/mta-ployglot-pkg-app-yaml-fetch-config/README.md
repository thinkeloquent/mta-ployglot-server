# mta-ployglot-pkg-app-yaml-fetch-config

Polyglot library that turns a loaded YAML endpoint configuration into an HTTP
fetch ARGS object — ready for any HTTP client (Node `fetch`, `axios`, Python
`httpx`, `requests`). The library does **not** perform the request itself.

## Packages

- [`packages/mjs/`](packages/mjs/) — `@ployglot/app-yaml-fetch-config` (Node ESM, raw `.mjs`).
- [`packages/py/`](packages/py/) — `app_yaml_fetch_config` (Python ≥ 3.11, hatchling).

## Active plan

See [`../AI-Agent-Plans/18/app-yaml-fetch-config-20260427-e51c8a3f/`](../AI-Agent-Plans/18/app-yaml-fetch-config-20260427-e51c8a3f/README.md).

## Examples

End-to-end runnable samples live in [`examples/`](examples/):

- `examples/sdk/` — embedded scenarios (`loadConfig` + `getFetchConfig`, full SDK class).
- `examples/api/` — function-signature contracts for each public surface.
