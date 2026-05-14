# print-routes-fastapi

Python helper that prints a FastAPI app's registered routes as a flat,
fixed-width table. Extracted from the `fastapi_server` reference server
(`SRC:/fastapi_server/fastapi_server/print_routes.py`) so it can be
consumed by any vanilla FastAPI app with no platform-core assumptions.

## Install

```bash
pip install print-routes-fastapi
```

Runtime dependency: `fastapi>=0.128,<1.0`.

## Usage — quick

```python
from print_routes_fastapi import print_routes

print_routes(app)   # call after all app.include_router(...) calls
```

## Usage — on startup

Call `print_routes` during FastAPI's `lifespan` startup so every host
logs its route table once at boot:

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
    return {"message": "hello"}
```

## API

### `print_routes(app: FastAPI) -> None`

Iterates `app.routes`, filters to `fastapi.routing.APIRoute` instances,
and prints one line per route:

```
  <path:<40> | <methods:<10> | <name>
```

Non-`APIRoute` entries (mounts, websocket routes, static mounts) are
silently skipped.

## Source

Extracted verbatim from
`/Users/Shared/autoload/A08b2d3148c2a49f49d710a5f6b36c8e1/platform/fastapi_server/fastapi_server/print_routes.py`.
No behavioural changes.
