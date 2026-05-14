# @mta/print-routes-fastify

Fastify 5.x ESM helper that prints the server's registered routes as a
flat, fixed-width table. Extracted from the `fastify_server` reference
server (`SRC:/fastify_server/src/print_routes.mjs`) so it can be
consumed by any vanilla Fastify app with no platform-core assumptions.

## Install

```bash
npm install @mta/print-routes-fastify
```

Peer dependencies: `fastify ^5.0.0`.

## Usage

```js
import Fastify from "fastify";
import { setupRouteCollector, printRoutes } from "@mta/print-routes-fastify";

const app = Fastify({ logger: true });

// Attach the collector BEFORE any route is registered.
setupRouteCollector(app);

app.get("/hello", async () => ({ message: "hello" }));
app.post("/echo", async (req) => ({ got: req.body }));

app.addHook("onReady", async () => printRoutes(app));

await app.listen({ port: 51000 });
```

## API

### `setupRouteCollector(fastify)`

Attaches an `onRoute` hook that records `url → Set<method>` into a
`Map` and decorates the Fastify instance under `_routeMap`. Must be
called **before** any `fastify.route()` / `fastify.get()` etc., or
earlier registrations will be missed.

### `printRoutes(fastify)`

Prints the header `Registered Routes - Fastify:` followed by one line
per URL:

```
  <url padEnd 55>           | <METHODS joined by ", ">
```

When `_routeMap` is absent (collector not attached) or empty, falls
back to Fastify's built-in `fastify.printRoutes({ commonPrefix: false })`.

## Source

Extracted verbatim from
`/Users/Shared/autoload/A08b2d3148c2a49f49d710a5f6b36c8e1/platform/fastify_server/src/print_routes.mjs`
— renamed from `print_routes.mjs` (snake_case) to `print-routes.mjs`
(kebab-case) to match npm conventions. Behaviour is preserved.
