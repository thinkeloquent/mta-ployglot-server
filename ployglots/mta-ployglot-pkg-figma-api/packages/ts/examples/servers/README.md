# Server integration examples (Fastify)

Three patterns for wiring `@polyglot/figma-api` into a Fastify app —
pick the one that matches your team's idiom. None of these are shipped
_as part of_ the SDK; they live here as reference wiring you can copy
into your own service.

| File                                                   | Pattern              | When to use                                                               |
| ------------------------------------------------------ | -------------------- | ------------------------------------------------------------------------- |
| [`01-fastify-plugin.ts`](01-fastify-plugin.ts)         | Plugin encapsulation | You want a drop-in plugin + `onClose` lifecycle. Cleanest for libs.       |
| [`02-fastify-lifecycle.ts`](02-fastify-lifecycle.ts)   | Lifecycle hooks      | You want per-request context (logger, timing) without extra decorators.   |
| [`03-fastify-decorators.ts`](03-fastify-decorators.ts) | Decorators           | Multi-tenant: per-caller token / proxy, shared transport for common case. |

### Install deps in a scratch project

```bash
npm i fastify fastify-plugin @polyglot/figma-api
```

### Run any of them

```bash
FIGMA_PASS=$YOUR_TOKEN npx tsx examples/servers/01-fastify-plugin.ts
# then in another shell:
curl http://localhost:3000/me
```

Each example binds to a different port (3000 / 3001 / 3002) so you can
run them side-by-side without conflict.
