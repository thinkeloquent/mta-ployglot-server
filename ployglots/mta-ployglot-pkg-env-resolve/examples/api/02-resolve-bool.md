# API Example: `resolveBool` / `resolve_bool`

## Goal

Resolve a value via the four-tier algorithm and coerce to `bool` per the canonical truthy-string set.

## Signature / Contract

### TypeScript

```ts
function resolveBool(
  arg: any,
  envKeys: string[] | string | null | undefined,
  config: Record<string, any> | null | undefined,
  configKey: string | null | undefined,
  defaultValue: boolean,
): boolean;
```

### Python

```python
def resolve_bool(
    arg: Any,
    env_keys: str | list[str] | None,
    config: dict[str, Any] | None,
    config_key: str | None,
    default: bool,
) -> bool: ...
```

## Inputs

Same five-parameter shape as [`resolve`](01-resolve.md). The `defaultValue` / `default` parameter is typed `bool` instead of `any`.

## Outputs

A `bool` (`true` or `false`). The classification rule, in order:

1. The resolved value is a `bool` → return as-is.
2. The resolved value is a `string` → return `true` iff `value.toLowerCase()` (Python: `value.lower()`) is in `TRUTHY_STRINGS = ("true", "1", "yes", "on")`.
3. The resolved value is a `number` → return `value !== 0`.
4. Otherwise → return `Boolean(value)` (TS) / `bool(value)` (py).

## Errors / Failure modes

| Condition          | Surface |
| ------------------ | ------- |
| —                  | None — every code path returns a `bool`. |

## Example

See [`examples/sdk/04-coercion-cascade.md`](../sdk/04-coercion-cascade.md).

## Notes

- Truthy strings are case-insensitive — `Yes`, `TRUE`, `On` all resolve to `true`.
- See [`SPEC.md`](../../SPEC.md#truthy-strings) and [`SPEC.md`](../../SPEC.md#boolean-coercion).
- The `TRUTHY_STRINGS` constant is exported from both packages for callers who want to extend or inspect it.
