# API: applyOverwritesFromContext

## Signature

**mjs** — `import { applyOverwritesFromContext } from '@ployglot/app-yaml-from-context'`

```ts
applyOverwritesFromContext(
  config: any,
  options?: {
    resolver?: ResolverContract,    // default: createResolver() from runtime-template-resolver
    context?: object,               // default: {}
    scope?: ComputeScope,           // default: REQUEST
    missingStrategy?: MissingStrategy,
  }
): Promise<any>
```

**py** — `from app_yaml_from_context import apply_overwrites_from_context`

```py
async def apply_overwrites_from_context(
    config: Any,
    *,
    resolver: ResolverContract | None = None,
    context: dict | None = None,
    scope: ComputeScope | None = None,
    missing_strategy: MissingStrategy | None = None,
) -> Any
```

## Behaviour

For each object node in `config`:

1. Recurse into all child object/array values **except** `overwrite_from_context` and
   `overwrite_from_env` keys (those are handled in step 2/3).
2. If the node has an `overwrite_from_env` mapping, look up each value (an env var name)
   via `process.env` / `os.environ` and merge the resolved key→value pairs into the
   current node via `deepMergeWithNullReplace`.
3. If the node has an `overwrite_from_context` mapping, hand it to
   `resolver.resolveObject(...)` and merge the resolved object via
   `deepMergeWithNullReplace`.
4. Preserve the (resolved) overwrite sections under their original keys for diagnostics.
5. `null` values in either overwrite section delete the parent key.

env section is processed **before** context section (parity with source).

## Inputs

| Parameter | Description |
| --------- | ----------- |
| `config`  | The config tree. Not mutated. |
| `resolver` | Duck-typed `{ resolve, resolveObject }`. Defaults to engine's `createResolver()`. |
| `context` | Passed to the resolver for `{{path}}` lookups. |
| `scope`   | Passed to `resolveObject` (`STARTUP` / `REQUEST`). |

## Output

A new object — input is never mutated. Arrays remain arrays, plain objects remain plain objects.

## Errors

Re-throws any error from the underlying resolver (`ComputeFunctionError`,
`RecursionLimitError`, `SecurityError`). If no resolver is injected and
`runtime-template-resolver` is not installed, throws a clear "package not installed"
error at first call.

## Example

See `examples/sdk/03-engine-and-applier-together.md`.
