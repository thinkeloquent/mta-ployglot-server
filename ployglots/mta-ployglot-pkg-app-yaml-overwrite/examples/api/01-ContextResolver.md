# API: ContextResolver

## Signature

**mjs** — `import { createResolver, ContextResolver } from '@ployglot/runtime-template-resolver'`

```ts
createResolver(options?: {
  registry?: ComputeRegistry,
  missingStrategy?: MissingStrategy,  // default ERROR
  maxDepth?: number,                  // default 10
}): ContextResolver

class ContextResolver {
  getRegistry(): ComputeRegistry
  registerNamespace(prefix: string, handler: (varName, defaultVal) => any): void
  unregisterNamespace(prefix: string): boolean
  resolve(expression: any, context: any, scope?: ComputeScope, depth?: number): Promise<any>
  resolveObject(obj: any, context: any, scope?: ComputeScope, depth?: number): Promise<any>
}
```

**py** — `from runtime_template_resolver import create_resolver, ContextResolver`

```py
def create_resolver(
    registry: ComputeRegistry | None = None,
    missing_strategy: MissingStrategy = MissingStrategy.ERROR,
    max_depth: int = 10,
) -> ContextResolver

class ContextResolver:
    def get_registry(self) -> ComputeRegistry
    def register_namespace(self, prefix: str, handler: Callable[[str, Any], Any]) -> None
    def unregister_namespace(self, prefix: str) -> bool
    async def resolve(self, expression, context, scope=ComputeScope.REQUEST, depth=0)
    async def resolve_object(self, obj, context, scope=ComputeScope.REQUEST, depth=0)
```

## Inputs

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `expression` | `string \| any` | A `{{...}}` template, a literal string, or a non-string (passed through). |
| `context` | `object` | Lookup root for `{{path}}` patterns; passed to compute fns and namespace handlers. |
| `scope` | `ComputeScope` | `STARTUP` (cached compute fns) or `REQUEST` (per-call). REQUEST fns invoked under STARTUP scope return the literal template. |
| `depth` | `number` | Recursion depth (clients should leave at default; resolver tracks internally). |

## Outputs

| Pattern | Result |
| ------- | ------ |
| `{{path.to.value}}` | Value at that path in `context` (lodash-`get` semantics). |
| `{{path.to.value | "default"}}` | Default coerced via `parseDefault` if path missing. |
| `{{fn:name}}` | Awaited result of the registered compute fn. |
| `{{fn:name | "default"}}` | Default applied if fn not registered. |
| `{{env.VAR}}` | Result of `envResolve(undefined, [VAR], undefined, undefined, default)`. |
| `{{env.VAR | "default"}}` | Default coerced via `parseDefault` if env unset. |
| Literal `"plain"` | Returned as-is. |
| Non-string | Returned as-is. |

## Errors

| Condition | Error |
| --------- | ----- |
| Path missing & `MissingStrategy.ERROR` & no inline default | `ComputeFunctionError` (`COMPUTE_FUNCTION_NOT_FOUND`) |
| Compute fn not registered & `ERROR` & no default | `ComputeFunctionError` (`COMPUTE_FUNCTION_NOT_FOUND`) |
| Compute fn throws | `ComputeFunctionError` (`COMPUTE_FUNCTION_FAILED`) — `originalError` attached |
| `depth > maxDepth` | `RecursionLimitError` |
| `__proto__` / `constructor` / `prototype` segment in path | `SecurityError` |

## Example

See `examples/sdk/01-engine-standalone.md`.
