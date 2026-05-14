# mta-ployglot-api-aws-s3

Polyglot (Node TypeScript + Python) API module wrapping the AWS S3
HTTPS client builder — a narrow surface that constructs a fully
configured S3 client honouring proxy URL, connect/read timeouts,
max-retries, TLS verification, path-style addressing, and custom
endpoints.

## Packages

- [`packages/mjs/`](packages/mjs/) — `@mta/polyglot-aws-s3` (Node TypeScript, pnpm + vitest).
- [`packages/py/`](packages/py/) — `polyglot-aws-s3` (Python async-context-manager, uv + pytest).

Env-resolution (`configFromEnv` / `config_from_env`) and the transport
verification probe (`verifyConnectivity` / `verify_connectivity`) are
**not** in this package — they belong to an app-integration layer that
constructs an `SDKConfig` and passes it into the builder.

## Build + test

```sh
# Node package (workspace install at repo root)
pnpm install
pnpm --filter "./packages/mjs" run test

# Python package
cd packages/py && make install && make test
```

Per-package Makefiles also expose `lint`, `build`, and `ci` targets.

## Examples

See [`examples/sdk/`](examples/sdk/) for runnable scenarios — direct
HTTPS, HTTPS via corporate proxy, custom endpoint (LocalStack/MinIO),
and the (planned) verification probe.

## Active plan

Tracked at
[`../AI-Agent-Plans/aws-s3-polyglot-plan-20260419-b7f3e2a1/`](../AI-Agent-Plans/aws-s3-polyglot-plan-20260419-b7f3e2a1/README.md).
Only Feature 02 (S3 client builder) is implemented here; Feature 01
(env-resolver) and Feature 03 (verification probe + smoke harness) are
out of scope for this package and belong to the app-integration plan.
