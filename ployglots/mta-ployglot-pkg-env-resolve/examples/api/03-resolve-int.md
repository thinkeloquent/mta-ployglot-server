# API Example: `resolveInt` / `resolve_int`

## Goal

Resolve a value via the four-tier algorithm and coerce to `int` with **strict** parsing — decimal-shaped strings ([D4](../../SPEC.md#integer-coercion-d4-d5)) and bool inputs ([D5](../../SPEC.md#integer-coercion-d4-d5)) both return the default.

## Signature / Contract

### TypeScript

```ts
function resolveInt(
  arg: any,
  envKeys: string[] | string | null | undefined,
  config: Record<string, any> | null | undefined,
  configKey: string | null | undefined,
  defaultValue: number,
): number;
```

### Python

```python
def resolve_int(
    arg: Any,
    env_keys: str | list[str] | None,
    config: dict[str, Any] | None,
    config_key: str | None,
    default: int,
) -> int: ...
```

## Inputs

Same five-parameter shape as [`resolve`](01-resolve.md). The default parameter is typed `number`/`int`.

## Outputs

A `number` (TS) / `int` (py). The classification rule, in order:

1. Resolved value is a `bool` → return `defaultValue` ([D5](../../SPEC.md#integer-coercion-d4-d5)).
2. Resolved value is a `number` → return it iff `Number.isInteger(value)` (TS) / `isinstance(value, int)` (py); else default.
3. Resolved value is a `string` → match against `/^-?\d+$/`; if no match return default ([D4](../../SPEC.md#integer-coercion-d4-d5)); else `parseInt(value, 10)` / `int(value)`.
4. Otherwise → return default.

## Errors / Failure modes

| Condition                           | Surface                                  |
| ----------------------------------- | ---------------------------------------- |
| Decimal-shaped string (`"3.14"`)    | Returns `defaultValue` ([D4](../../SPEC.md#integer-coercion-d4-d5)). |
| Bool input (`true`/`false`)         | Returns `defaultValue` ([D5](../../SPEC.md#integer-coercion-d4-d5)). |
| Non-integer number (`1.5`)          | Returns `defaultValue`.                  |
| Non-numeric string (`"abc"`)        | Returns `defaultValue`.                  |
| Any other type                      | Returns `defaultValue`. No exception escapes. |

## Example

```ts
import { resolveInt } from '@org/env-resolve';

process.env.PORT = '8080';
const port = resolveInt(undefined, 'PORT', null, null, 80);
// 8080
```

```python
import os
from env_resolve import resolve_int

os.environ["PORT"] = "8080"
port = resolve_int(None, "PORT", None, None, 80)
# 8080
```

## Notes

- This is the most drift-prone of the four functions in the original sources. The aligned spec normalizes both sides on strict integer-string matching.
- See [`SPEC.md`](../../SPEC.md#integer-coercion-d4-d5) for the canonical rule and rationale.
