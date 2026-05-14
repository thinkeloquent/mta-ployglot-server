# mta-ployglot-server-print-routes

Polyglot extraction of route-listing helpers: `@mta/print-routes-fastify`
(Node ESM, Fastify 5.x) and `print_routes_fastapi` (Python, FastAPI
0.128.x). Extracted from the upstream monorepo at
`/Users/Shared/autoload/A08b2d3148c2a49f49d710a5f6b36c8e1/platform/`
(`fastify_server/src/print_routes.mjs` and
`fastapi_server/fastapi_server/print_routes.py`) so each helper can be
installed and consumed independently against vanilla Fastify / FastAPI
instances, with zero `platform-core-*` assumptions.

## Packages

| Package                      | Language    | Path            | Install                                  |
| ---------------------------- | ----------- | --------------- | ---------------------------------------- |
| `@mta/print-routes-fastify`  | Node (ESM)  | `packages/mjs/` | `npm install @mta/print-routes-fastify`  |
| `print-routes-fastapi`       | Python      | `packages/py/`  | `pip install print-routes-fastapi`       |

## Quickstart — Fastify

```js
import Fastify from "fastify";
import { setupRouteCollector, printRoutes } from "@mta/print-routes-fastify";

const app = Fastify();
setupRouteCollector(app);              // BEFORE any route registration
app.get("/hello", async () => ({ ok: true }));
app.addHook("onReady", async () => printRoutes(app));
await app.listen({ port: 51000 });
```

## Quickstart — FastAPI

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from print_routes_fastapi import print_routes

@asynccontextmanager
async def lifespan(app: FastAPI):
    print_routes(app)
    yield

app = FastAPI(lifespan=lifespan)

@app.get("/hello")
def get_hello():
    return {"ok": True}
```

## Repository layout

```
.
├── packages/
│   ├── mjs/                     # @mta/print-routes-fastify
│   └── py/                      # print-routes-fastapi
├── examples/
│   ├── fastify-app/             # Runnable Fastify smoke app
│   └── fastapi-app/             # Runnable FastAPI smoke app
├── docs/
│   └── parity.md                # MJS ↔ PY parity contract
├── Makefile                     # Top-level: delegates to packages/*
├── package.json                 # npm workspace root
└── pyproject.toml               # uv workspace root
```

## Development

Run the full polyglot pipeline (`ci-install → lint → test → build`) in
every package from the repo root:

```bash
make ci
```

Per-package targets are available under `packages/mjs/Makefile` and
`packages/py/Makefile`.

## License

[MIT](LICENSE).
