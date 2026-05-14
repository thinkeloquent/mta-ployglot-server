# API: ComputeRegistry

## Signature

**mjs** — `import { ComputeRegistry, ComputeScope } from '@ployglot/runtime-template-resolver'`

```ts
class ComputeRegistry {
  register(name: string, fn: Function, scope?: ComputeScope): void  // default REQUEST
  unregister(name: string): boolean
  has(name: string): boolean
  list(): string[]
  getScope(name: string): ComputeScope | undefined
  clear(): void
  clearCache(): void
  resolve(name: string, context: any, propertyPath?: string): Promise<any>
  validateName(name: string): void  // throws on bad name
}

const ComputeScope = { STARTUP: 'STARTUP', REQUEST: 'REQUEST' }
```

**py** — `from runtime_template_resolver import ComputeRegistry, ComputeScope`

```py
class ComputeRegistry:
    def register(self, name: str, fn, scope: ComputeScope = ComputeScope.REQUEST) -> None
    def unregister(self, name: str) -> bool
    def has(self, name: str) -> bool
    def list(self) -> list[str]
    def get_scope(self, name: str) -> ComputeScope | None
    def clear(self) -> None
    def clear_cache(self) -> None
    async def resolve(self, name, context, property_path: str | None = None) -> Any
    def validate_name(self, name: str) -> None  # raises ValueError
```

## Inputs

| Parameter | Description |
| --------- | ----------- |
| `name` | `^[a-zA-Z_][a-zA-Z0-9_]*$` — invalid names raise. |
| `fn` | Sync or async; signature `(context, propertyPath)`. |
| `scope` | `STARTUP` caches result with key `name:propertyPath`; `REQUEST` re-runs every call. |

## Outputs / Errors

| Condition | Result |
| --------- | ------ |
| Function returns Promise / awaitable | Resolved value. |
| `STARTUP` cache hit | Cached value (no fn call). |
| Unknown `name` | `ComputeFunctionError` — `code === COMPUTE_FUNCTION_NOT_FOUND`. |
| Fn throws | `ComputeFunctionError` — `code === COMPUTE_FUNCTION_FAILED`, `ctx.originalError` populated. |

## Cache key

`${name}:${propertyPath ?? ''}` — same `name` registered with `STARTUP` scope but called with different `propertyPath` values produces distinct cached entries.

## Example

```js
const reg = new ComputeRegistry();
reg.register('now', () => Date.now(), ComputeScope.STARTUP);
const a = await reg.resolve('now', {});
const b = await reg.resolve('now', {});  // cached — equal to a
```
