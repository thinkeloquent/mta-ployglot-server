# fastapi-server

Runtime-neutral polyglot bootstrap orchestrator for FastAPI. Discover `*.env.py`, `*.lifecycle.py`, and `*.routes.py` files at boot; register them via a pluggable addon pipeline; ship your service without writing bootstrap code.

## Install

```bash
pip install thinkeloquent-fastapi-server
```

## Quickstart

```python
import asyncio
import uvicorn
from fastapi_server.bootstrap import (
    setup, SetupOptions, create_fastapi_adapter,
    environment_addon, lifecycle_addon, route_addon,
)

async def build():
    return await setup(
        create_fastapi_adapter(),
        [environment_addon, lifecycle_addon, route_addon],
        {
            "title": "my-service",
            "port": 8000,
            "paths": {
                "environment": ["config/environment"],
                "lifecycles": ["config/lifecycles"],
                "routes": ["config/routes"],
            },
        },
        SetupOptions(base_dir="."),
    )

app = asyncio.run(build())
uvicorn.run(app, host="0.0.0.0", port=8000)
```

See [`examples/quickstart/`](examples/quickstart/) for a runnable demo, or run the default CLI: `fastapi-server`.

## API

| Export                                               | Purpose                                                                    |
| ---------------------------------------------------- | -------------------------------------------------------------------------- |
| `setup(adapter, addons, config, opts)`               | Build a ready app; run addon pipeline; schedule startup/shutdown hooks.    |
| `create_fastapi_adapter()`                           | FastAPI + uvicorn runtime adapter.                                         |
| `environment_addon`, `lifecycle_addon`, `route_addon` | Built-in bootstrap addons (priorities 10/20/30).                          |
| `Registry`                                           | Container for addons; supports priority ordering and failure isolation.    |
| `create_loader_report(name)`                         | Canonical loader report shape.                                             |
| `merge_config(defaults, user, base_dir)`             | Merge two BootstrapConfig dicts with path resolution.                      |

## Updating JSON Schema contracts

The three JSON Schemas under `contracts/` are intentionally duplicated across `fastify-server` and `fastapi-server` so each package is self-contained. When you change a schema:

1. Edit the file in whichever package you're working in.
2. Copy the change to the other package (`scripts/sync-contracts.sh to-fastapi` or `to-fastify`).
3. Run the parity test: `pytest tests/test_contract_parity.py`.
4. Commit both packages in the same PR.

## License

MIT
