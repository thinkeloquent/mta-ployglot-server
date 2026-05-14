# Server integration examples (FastAPI)

Three patterns for wiring `polyglot-figma-api` into a FastAPI app —
pick the one that matches your team's idiom. None of these are shipped
*as part of* the SDK; they live here as reference wiring you can copy
into your own service.

| File                                               | Pattern        | When to use                                                           |
| -------------------------------------------------- | -------------- | --------------------------------------------------------------------- |
| [`fastapi_lifespan.py`](fastapi_lifespan.py)       | Lifespan       | Simplest. One shared client, reached via `app.state`.                  |
| [`fastapi_dependency.py`](fastapi_dependency.py)   | Dependency-Inj | Handlers take `figma: FigmaDep`. Great for testability.                |
| [`fastapi_middleware.py`](fastapi_middleware.py)   | Middleware     | Per-request context + central `FigmaError` → HTTP status mapping.      |

### Install deps

```bash
pip install fastapi uvicorn polyglot-figma-api
```

### Run any of them

```bash
FIGMA_PASS=$YOUR_TOKEN uvicorn examples.servers.fastapi_lifespan:app --reload
# then:
curl http://localhost:8000/me
```
