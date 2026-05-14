# SDK Example: Engine standalone

## Goal

Use `@ployglot/runtime-template-resolver` directly on a single string, no applier required.

## Prerequisites

- `npm install` from the repo root (resolves the engine + sibling `@org/env-resolve`).
- `export USERNAME=alice` in shell.

## Code (mjs)

```js
import { createResolver, ComputeScope } from '@ployglot/runtime-template-resolver';

const resolver = createResolver();
resolver.getRegistry().register('now', () => new Date('2026-04-27').toISOString(), ComputeScope.STARTUP);

console.log(await resolver.resolve('{{request.user}}', { request: { user: 'alice' } }));
console.log(await resolver.resolve('{{fn:now}}', {}));
console.log(await resolver.resolve('{{env.USERNAME}}', {}));
console.log(await resolver.resolve('{{env.MISSING | "fallback"}}', {}));
```

## Code (py)

```python
import asyncio
from runtime_template_resolver import create_resolver, ComputeScope

resolver = create_resolver()
resolver.get_registry().register("now", lambda *_: "2026-04-27T00:00:00Z", ComputeScope.STARTUP)

print(asyncio.run(resolver.resolve("{{request.user}}", {"request": {"user": "alice"}})))
print(asyncio.run(resolver.resolve("{{fn:now}}", {})))
print(asyncio.run(resolver.resolve("{{env.USERNAME}}", {})))
print(asyncio.run(resolver.resolve('{{env.MISSING | "fallback"}}', {})))
```

## Expected outcome

```
alice
2026-04-27T00:00:00.000Z   # mjs (Date toISOString); py emits 2026-04-27T00:00:00Z
alice
fallback
```

## Notes

- `{{env.VAR}}` always goes through the env-resolve sibling — `resolve(undefined, [VAR_NAME], undefined, undefined, default)`.
- The compute function is registered with `STARTUP` scope, so the timestamp is cached on first call.
- A REQUEST-scope function called during `STARTUP` scope returns the literal template (e.g. `{{fn:per_request}}`); see `examples/api/02-ComputeRegistry.md`.
