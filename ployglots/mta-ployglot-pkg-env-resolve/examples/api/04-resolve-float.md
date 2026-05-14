# API Example: `resolveFloat` / `resolve_float`

## Goal

Resolve a value via the four-tier algorithm and coerce to `float` with **strict** parsing — partial-numeric strings (`"12abc"`) return the default ([D6](../../SPEC.md#float-coercion-d6)).

## Signature / Contract

### TypeScript

```ts
function resolveFloat(
  arg: any,
  envKeys: string[] | string | null | undefined,
  config: Record<string, any> | null | undefined,
  configKey: string | null | undefined,
  defaultValue: number,
): number;
```

### Python

```python
def resolve_float(
    arg: Any,
    env_keys: str | list[str] | None,
    config: dict[str, Any] | None,
    config_key: str | None,
    default: float,
) -> float: ...
```

## Inputs

Same five-parameter shape as [`resolve`](01-resolve.md). The default parameter is typed `number`/`float`.

## Outputs

A `number` (TS) / `float` (py). The classification rule, in order:

1. Resolved value is a `number` → return it iff `Number.isFinite(value)` (TS); always return as `float(value)` (py).
2. Resolved value is a `string` → if empty, return default; else compute `Number(value)` (TS) / `float(value)` (py); reject if not finite (`Number.isFinite` / caught `ValueError`).
3. Resolved value is a `bool` → return `Number(value)` / `float(value)` (no D5 analog for floats — `True` → `1.0`).
4. Otherwise → return default.

## Errors / Failure modes

| Condition                              | Surface                                                 |
| -------------------------------------- | ------------------------------------------------------- |
| Partial-numeric string (`"12abc"`)     | Returns `defaultValue` ([D6](../../SPEC.md#float-coercion-d6)). |
| Empty string (`""`)                    | Returns `defaultValue` (overrides JS `Number("")` → `0`). |
| Non-numeric string (`"abc"`)           | Returns `defaultValue`.                                 |
| `Infinity` / `NaN` numeric input       | Returns `defaultValue` (TS rejects via `isFinite`).     |
| Any other type                         | Returns `defaultValue`. No exception escapes.           |

## Example

```ts
import { resolveFloat } from '@org/env-resolve';

process.env.RATE_LIMIT = '0.25';
const rate = resolveFloat(undefined, 'RATE_LIMIT', null, null, 1.0);
// 0.25
```

```python
import os
from env_resolve import resolve_float

os.environ["RATE_LIMIT"] = "0.25"
rate = resolve_float(None, "RATE_LIMIT", None, None, 1.0)
# 0.25
```

## Notes

- Scientific notation is accepted: `Number("1e3")` is `1000`; Python's `float("1e3")` matches.
- The TS port swaps `parseFloat` for `Number(value)` to avoid the lenient-tokenization behavior; the Python port relies on `float()` already being strict.
- See [`SPEC.md`](../../SPEC.md#float-coercion-d6) for the canonical rule.
