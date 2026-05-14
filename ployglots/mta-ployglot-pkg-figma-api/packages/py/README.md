# polyglot-figma-api

Python async client for the Figma REST API, layered on top of
[`polyglot-fetch-http-client`][fetch-client]. Token auth, env-driven
config, proxy-aware, pluggable transport.

[fetch-client]: https://github.com/thinkeloquent/mta-ployglot-pkg-fetch-client

## Install

Linked to the sibling fetch-client workspace via
`[tool.uv.sources]` in the repo-root `pyproject.toml`. Install from
the workspace root:

```bash
uv sync --all-packages --extra dev     # at the repo root
```

## Quickstart

```python
import asyncio
from figma_api import FigmaClient

async def main():
    # `proxy={}` auto-detects from HTTPS_PROXY / HTTP_PROXY.
    # `token` falls back to env FIGMA_PASS.
    async with FigmaClient(proxy={}) as client:
        me = await client.me.get()
        print(f"@{me['handle']}")

asyncio.run(main())
```

## Environment

| Var               | Required | Description                                              |
| ----------------- | :------: | -------------------------------------------------------- |
| `FIGMA_HOST`      |          | Default `https://api.figma.com`.                         |
| `FIGMA_USER`      |          | Placeholder — Figma is token-only.                       |
| `FIGMA_PASS`      |    ✔     | Figma Personal Access Token.                             |
| `HTTPS_PROXY`     |          | Outbound HTTPS proxy.                                    |
| `HTTP_PROXY`      |          | Outbound HTTP proxy.                                     |
| `HTTP_PROXY_USER` |          | Proxy username.                                          |
| `HTTP_PROXY_PASS` |          | Proxy password.                                          |

## Proxy contract

```python
FigmaClient(token=token, proxy={})                                      # auto-detect
FigmaClient(token=token, proxy={"host": "http://p:3128"})
FigmaClient(token=token, proxy={"host": "http://p:3128", "user": "u", "pass": "pw"})
```

## BYO fetch client

```python
from fetch_http_client import AsyncClient, APIKeyAuth, RetryConfig
from figma_api import FigmaClient, fetch_client_from_polyglot

outer = AsyncClient(
    base_url="https://api.figma.com",
    auth=APIKeyAuth(TOKEN, "X-Figma-Token"),
    retry=RetryConfig(max_attempts=5),
)

client = FigmaClient(token=TOKEN, fetch_client=fetch_client_from_polyglot(outer))
```

## Public surface

| Export                                 | Purpose                                                      |
| -------------------------------------- | ------------------------------------------------------------ |
| `FigmaClient`                          | SDK entry point. Exposes all 9 resource sub-SDKs listed below.|
| `create_figma_fetch_client`            | Build a standalone FetchClient from env + options.            |
| `fetch_client_from_polyglot`           | Wrap a user `AsyncClient` as a FetchClient (BYO).             |
| `resolve_figma_config`                 | Merge explicit options with env.                              |
| `build_proxy`                          | Build a `Proxy` from bag + env fallbacks.                     |
| `build_figma_retry_config`, `FIGMA_DEFAULT_RETRY` | Figma-sensible retry presets + the compiler that honours `force_overwrite`. |
| `FigmaError` + subclasses              | Typed error tree.                                             |
| `create_logger`, `mask_token`          | Structured logger + token masking.                            |

### Resource surface on `FigmaClient`

| Accessor                      | Endpoints                                               | Tier            |
| ----------------------------- | ------------------------------------------------------- | --------------- |
| `client.me`                   | GET `/v1/me`                                            | basic           |
| `client.files`                | get / nodes / images / image_fills / meta / versions    | basic           |
| `client.comments`             | CRUD comments + reactions                               | basic           |
| `client.projects`             | team projects, project files                            | basic           |
| `client.components`           | team/file/get for components, component_sets, styles    | basic           |
| `client.variables`            | local / published / post                                | **enterprise**  |
| `client.dev_resources`        | list / create / update / delete                         | basic           |
| `client.library_analytics`    | 6 actions/usages endpoints                              | **enterprise**  |
| `client.webhooks`             | create / get / update / delete / list_for_team / requests | basic (v2)    |

### Retry semantics

By default, `FigmaClient` pre-wires Figma-sensible retry:

```
max_attempts      3
base_delay        1.0s
max_delay         30.0s
multiplier        2.0   (1s → 2s → 4s, capped at max_delay)
retry_on_status   frozenset({429, 500, 502, 503, 504})
```

Override modes:

```python
FigmaClient(token=...)                                 # Mode A: Figma defaults
FigmaClient(token=..., retry=False)                    # Mode B: outer owns retry
FigmaClient(token=..., retry={"max_attempts": 5})       # merge on top
FigmaClient(
    token=...,
    retry={"max_attempts": 1, "retry_on_status": frozenset({503})},
    force_overwrite_retry=True,                         # replace, don't merge
)
```

## Testing

```bash
make test                 # unit (pytest + respx-friendly, mocked transport)
make test-integration     # live API (needs FIGMA_PASS)
make lint                 # ruff check
make build                # sdist + wheel
make ci                   # full pipeline
```

## Server integration

This package ships **SDK only**. Three reference wiring patterns for
FastAPI live under [`examples/servers/`](examples/servers/) —
lifespan, dependency injection, middleware. Install in a scratch
project (`pip install fastapi uvicorn polyglot-figma-api`).

## Publishing

At publish time, swap the local `tool.uv.sources` override to a
registry version of `polyglot-fetch-http-client` — path-based sources
don't travel with a published wheel. The `tool.hatch.build.targets.wheel`
allowlist already ships only the `figma_api/` package. To audit the
wheel:

```bash
make build                             # writes ./dist/*.whl
unzip -l dist/polyglot_figma_api-*.whl # inspect tarball contents
```

For a full round-trip: install the wheel in a scratch venv
(`pip install dist/polyglot_figma_api-0.1.0-py3-none-any.whl`),
import it, run a smoke call.

## License

MIT.
