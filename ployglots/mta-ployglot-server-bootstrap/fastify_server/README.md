# fastify-server

Runtime-neutral polyglot bootstrap orchestrator for Fastify. Discover `*.env.mjs`, `*.lifecycle.mjs`, and `*.routes.mjs` files at boot; register them via a pluggable addon pipeline; ship your service without writing bootstrap code.

## Install

```bash
npm install fastify-server
```

## Quickstart

```js
import {
  setup,
  createFastifyAdapter,
  environmentAddon,
  lifecycleAddon,
  routeAddon,
} from "fastify-server";

const server = await setup(
  createFastifyAdapter(),
  [environmentAddon, lifecycleAddon, routeAddon],
  {
    title: "my-service",
    port: 3000,
    paths: {
      environment: ["config/environment"],
      lifecycles: ["config/lifecycles"],
      routes: ["config/routes"],
    },
  },
);

await server.listen({ port: 3000, host: "0.0.0.0" });
```

See [`examples/quickstart/`](examples/quickstart/) for a runnable demo.

## API

| Export                                             | Purpose                                                                    |
| -------------------------------------------------- | -------------------------------------------------------------------------- |
| `setup(adapter, addons, config, opts)`             | Build a ready server; run addon pipeline; schedule startup/shutdown hooks. |
| `createFastifyAdapter(options)`                    | Fastify 5 runtime adapter.                                                 |
| `environmentAddon`, `lifecycleAddon`, `routeAddon` | Built-in bootstrap addons (priorities 10/20/30).                           |
| `Registry`                                         | Container for addons; supports priority ordering and failure isolation.    |
| `createLoaderReport(name)`                         | Canonical loader report shape.                                             |
| `mergeConfig(defaults, user, baseDir)`             | Merge two BootstrapConfig dicts with path resolution.                      |

## Updating JSON Schema contracts

The three JSON Schemas under `contracts/` are intentionally duplicated across `fastify-server` and `fastapi-server` so each package is self-contained. When you change a schema:

1. Edit the file in whichever package you're working in.
2. Copy the change to the other package (`scripts/sync-contracts.sh to-fastapi` or `to-fastify`).
3. Run the parity test: `cd fastapi_server && pytest tests/test_contract_parity.py`.
4. Commit both packages in the same PR.

## License

MIT
