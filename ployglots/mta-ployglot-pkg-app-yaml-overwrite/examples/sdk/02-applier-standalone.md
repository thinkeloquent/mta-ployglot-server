# SDK Example: Applier standalone

## Goal

Use `@ployglot/app-yaml-from-context` with a hand-rolled, single-method resolver — no engine package import.

## Prerequisites

- `npm install` (or the py equivalent: `uv sync`) from the repo root.

## Code (mjs)

```js
import { applyOverwritesFromContext } from '@ployglot/app-yaml-from-context';

// Hand-rolled resolver — duck-typed `{ resolve, resolveObject }`.
const customResolver = {
  async resolve(expr) {
    return typeof expr === 'string' ? expr.toUpperCase() : expr;
  },
  async resolveObject(obj) {
    if (Array.isArray(obj)) return Promise.all(obj.map((v) => this.resolveObject(v)));
    if (obj && typeof obj === 'object') {
      const out = {};
      for (const k of Object.keys(obj)) out[k] = await this.resolveObject(obj[k]);
      return out;
    }
    return typeof obj === 'string' ? obj.toUpperCase() : obj;
  },
};

const config = {
  api_key: null,
  overwrite_from_context: { api_key: 'fallback-key' },
};

console.log(await applyOverwritesFromContext(config, { resolver: customResolver }));
```

## Code (py)

```python
import asyncio
from app_yaml_from_context import apply_overwrites_from_context


class UpperResolver:
    async def resolve(self, expr, *_):
        return expr.upper() if isinstance(expr, str) else expr

    async def resolve_object(self, obj, *_):
        if isinstance(obj, list):
            return [await self.resolve_object(v) for v in obj]
        if isinstance(obj, dict):
            return {k: await self.resolve_object(v) for k, v in obj.items()}
        return obj.upper() if isinstance(obj, str) else obj


config = {"api_key": None, "overwrite_from_context": {"api_key": "fallback-key"}}
print(asyncio.run(apply_overwrites_from_context(config, resolver=UpperResolver())))
```

## Expected outcome

```
{ api_key: 'FALLBACK-KEY', overwrite_from_context: { api_key: 'FALLBACK-KEY' } }
```

## Notes

- The applier only needs a duck-typed `{ resolve, resolveObject }` — it does **not** import the engine.
- Real callers should use `runtime-template-resolver` (`createResolver()` / `create_resolver()`) for consistent template behaviour. See `03-engine-and-applier-together.md`.
- `null` in `overwrite_from_context` deletes the parent key; in this example `api_key: null` is replaced (not deleted) because the override section provides a non-null replacement.
