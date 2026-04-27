# Twin Parity — `mta-fastify-server` ↔ `mta-fastapi-server`

Both apps share the same `setup(adapter, addons, config)` orchestrator (from the `mta-ployglot-server-bootstrap` sibling, symlinked into `ployglots/`) and the same three-addon contract (environment / lifecycle / route). Everything below is **intentional drift**, not a bug.

## Suffix convention

| Axis            | mjs twin               | py twin                |
|-----------------|------------------------|------------------------|
| Environment     | `.env.mjs`             | `.env.py`              |
| Lifecycle       | `.lifecycle.mjs`       | `.lifecycle.py`        |
| Route           | `.routes.mjs`          | `.routes.py`           |
| Numeric prefix  | `<NN>_<name>.<suffix>` | same                   |
| Discovery order | ascending prefix       | ascending prefix       |

The numeric prefix is the *only* ordering contract. Names are for humans.

## Export shapes

| File type | mjs export                                                    | py export                                              |
|-----------|---------------------------------------------------------------|--------------------------------------------------------|
| env       | side-effect module (mutates `process.env`)                    | side-effect module (mutates `os.environ`)              |
| lifecycle | `export { onInit?, onStartup?, onShutdown? }` or default-object with those keys | `def on_init(app, config)?`, `async def on_startup(app, config)?`, `async def on_shutdown(app, config)?` |
| route     | `export default async (fastify, config) => void` (or `mount`) | `def mount(app: FastAPI, config) -> APIRouter`         |

### Why the FastAPI route factory is sync

The FastAPI adapter's `register_routes(app, fn)` calls `fn(app, config)` synchronously and includes the returned `APIRouter`. Returning a coroutine raises — FastAPI can't mount a router that hasn't been built yet. If async init is truly needed, stash the work on `app.state` inside the sync factory and await it from an `on_startup` lifecycle hook. Fastify has no analog because `server.register(async (scope) => …)` happily awaits an async plugin.

## Lifecycle timing

| Phase        | mjs twin                                           | py twin                                                 |
|--------------|----------------------------------------------------|---------------------------------------------------------|
| `onInit` / `on_init` | Sync during `setup()`, before the server listens | Sync during `setup()`, before `FastAPI(lifespan=...)` resolves |
| `onStartup` / `on_startup` | Attached to `server.addHook("onReady", …)`, runs once per boot | Runs inside FastAPI's `lifespan` context-manager entry  |
| `onShutdown` / `on_shutdown` | Attached to `server.addHook("onClose", …)` + `close-with-grace` | Runs inside FastAPI's `lifespan` context-manager exit   |

Practical upshot: an `onInit` failure prevents the server from binding on either side. `onStartup` failures are logged but do not block traffic (Fastify's `onReady` collects errors). Match the Python twin's behavior if you touch the shared lifecycle addon.

## Request state

Both adapters implement `attach_request_state(server, initial_state)` but the mechanism differs:

- **Fastify:** `server.decorateRequest("state", null)` at setup time, plus an `onRequest` hook that `structuredClone`s `initial_state` into `req.state` per request.
- **FastAPI:** ASGI middleware (`_RequestStateMiddleware`) that `copy.deepcopy`s `initial_state` into `request.state.state` (and also flattens top-level keys onto `request.state` for convenience).

Both give per-request isolated state. The mjs side exposes only `req.state`; the py side exposes both `request.state.state` and `request.state.<key>` — when writing cross-language code, prefer the `.state` nested form.

## Port defaults

| Scope                 | mjs twin              | py twin               |
|-----------------------|-----------------------|-----------------------|
| In-container          | `3000` (Dockerfile)   | `8080` (Dockerfile)   |
| Host-direct dev (main) | `51000`              | `52000`               |
| Compose mapping       | host `5100` → 3000    | host `5200` → 8080    |
| Env var to override   | `PORT` (both)         | `PORT` (both)         |

The docker-compose host ports `FASTIFY_PORT` / `FASTAPI_PORT` are for the wrapper, not for the app processes.

## Observability

Both apps support opt-in per-request JSON logs via `LOG_DIR`:

| File                               | mjs twin | py twin |
|------------------------------------|----------|---------|
| `<LOG_DIR>/<name>.request.log`    | appended on `onResponse` | appended on middleware exit |
| `<LOG_DIR>/<name>.error.log`      | appended on `onError` hook | appended on middleware exception |

Shape is identical (JSON one-per-line with `t`, `reqId/method/path`, `status`, `rt_ms`).

## What does NOT drift

- Addon priorities: `environment` @10, `lifecycle` @20, `route` @30 on both sides.
- `config.paths` keys: `environment`, `lifecycles`, `routes` (plural) on both sides.
- `_loaderReports` decorator key on the server/app instance — available on both.
- `_config` decorator key on the server/app instance — available on both.
- `initial_state` shape: a flat `{string: any}` object.
