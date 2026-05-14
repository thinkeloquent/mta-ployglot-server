# Parity — @mta/print-routes-fastify ↔ print-routes-fastapi

Both packages solve the same problem: list a running HTTP server's
registered routes in a flat, fixed-width table at startup so hosts can
emit a single human-readable "what's mounted" line. The surfaces are
kept minimal and twinned across Node (Fastify) and Python (FastAPI).
One minor drift (`setupRouteCollector`) is intentional, framework-driven,
and documented below.

## Parity table

| Aspect             | MJS (`@mta/print-routes-fastify`)       | PY (`print-routes-fastapi`)                 | Notes                                    |
| ------------------ | --------------------------------------- | ------------------------------------------- | ---------------------------------------- |
| Package name       | `@mta/print-routes-fastify`             | `print-routes-fastapi`                      |                                          |
| Import             | `setupRouteCollector, printRoutes`      | `print_routes`                              | See intentional drift below.             |
| Function signature | `printRoutes(fastify)`                  | `print_routes(app: FastAPI)`                |                                          |
| Header line        | `Registered Routes - Fastify:`          | `Registered Routes - FastAPI:`              | Identical shape, different framework.    |
| Row format         | `<URL padEnd 55> \| <methods>`          | `<path:<40> \| <methods:<10> \| <name>`     | PY also prints the endpoint name.        |
| When to call       | Inside `onReady` hook                   | Inside `lifespan` startup                   | Both fire after all routes register.     |
| Runtime dep        | `fastify` (peer) `^5.0.0`               | `fastapi` (runtime) `>=0.128,<1.0`          |                                          |
| Node / Python min  | Node 20                                 | Python 3.11                                 |                                          |
| Output channel     | `console.log`                           | `print()`                                   | No structured logger; follow-up feature. |
| License            | MIT                                     | MIT                                         |                                          |

## Intentional drift

- **`setupRouteCollector` exists only on the MJS side.** Fastify does
  not expose a public `routes` list. The canonical way to observe
  every registered route is the `onRoute` registration hook, so the
  MJS package ships a two-step ritual: `setupRouteCollector(fastify)`
  BEFORE any `fastify.route()` call, then `printRoutes(fastify)` after
  `fastify.ready()`. If the collector is missing or empty,
  `printRoutes` falls back to Fastify's built-in
  `fastify.printRoutes({ commonPrefix: false })` so callers still get
  *something*.

- **The PY side has no analog.** FastAPI exposes `app.routes`
  directly as a synchronous list, so there is no ordering constraint
  and no decorator to attach. The Python function is a single
  `print_routes(app)` call that iterates, filters to
  `fastapi.routing.APIRoute`, and prints.

- **Row format differs intentionally.** The Fastify source formats
  `url | methods` (two columns) because Fastify doesn't track a
  distinct "name" per route. The FastAPI source adds a third column
  with `route.name` because FastAPI *does* carry that field and the
  upstream server prints it. We preserved each language's source
  format verbatim rather than forcing a lowest-common-denominator
  table.

- **Both packages intentionally include the framework name in the
  header** (`- Fastify:` / `- FastAPI:`) so mixed-stack logs
  (polyglot servers piping both into one log aggregator) remain
  readable without extra tagging.

## Runnable proofs

- [Fastify example](../examples/fastify-app/) — invokes
  `setupRouteCollector` before routes, then prints on `onReady`.
- [FastAPI example](../examples/fastapi-app/) — invokes
  `print_routes` inside `lifespan` startup.

## Source provenance

- MJS: extracted from
  `SRC:/fastify_server/src/print_routes.mjs` (44 lines).
- PY: extracted from
  `SRC:/fastapi_server/fastapi_server/print_routes.py` (14 lines).

Upstream path root: `/Users/Shared/autoload/A08b2d3148c2a49f49d710a5f6b36c8e1/platform/`.
