# API Example: `resolve` / `resolve()`

## Goal

Resolve a configuration value from the first of four sources: arg → env → config → default.

## Signature / Contract

### TypeScript

```ts
function resolve(
  arg: any,
  envKeys: string[] | string | null | undefined,
  config: Record<string, any> | null | undefined,
  configKey: string | null | undefined,
  defaultValue: any,
): any;
```

### Python

```python
def resolve(
    arg: Any,
    env_keys: str | list[str] | None,
    config: dict[str, Any] | None,
    config_key: str | None,
    default: Any,
) -> Any: ...
```

## Inputs

| Name (TS / py)             | Type                                                | Required | Description                                                          |
| -------------------------- | --------------------------------------------------- | -------- | -------------------------------------------------------------------- |
| `arg` / `arg`              | any                                                 | yes      | Tier 1 value. Nullish counts as unset ([D1](../../SPEC.md#unset-sentinel-rule-d1)). |
| `envKeys` / `env_keys`     | string \| string[] \| nullish                       | yes      | Tier 2 keys. Nullish skips tier ([D7](../../SPEC.md#env-keys-nullish-tolerance-d7)). |
| `config` / `config`        | record / dict \| nullish                            | yes      | Tier 3 source.                                                       |
| `configKey` / `config_key` | string \| nullish                                   | yes      | Tier 3 key.                                                          |
| `defaultValue` / `default` | any                                                 | yes      | Tier 4 fallback.                                                     |

## Outputs

The first non-nullish value among the four tiers. Type matches whatever the resolved tier produced — env-tier results are always strings (Node `process.env` / Python `os.environ` semantics); config-tier and arg-tier results are whatever the caller passed in.

## Errors / Failure modes

| Condition          | Surface                                                                  |
| ------------------ | ------------------------------------------------------------------------ |
| —                  | None — every code path returns a value. The aligned spec eliminated the original Python `TypeError` on `env_keys=None` ([D7](../../SPEC.md#env-keys-nullish-tolerance-d7)). |

## Example

See [`examples/sdk/01-resolve-arg-tier.md`](../sdk/01-resolve-arg-tier.md), [`02-env-first-match.md`](../sdk/02-env-first-match.md), and [`03-config-non-nullish.md`](../sdk/03-config-non-nullish.md).

## Notes

- See [`SPEC.md`](../../SPEC.md#algorithm--four-tier-resolution) for the formal algorithm.
- Tier 3 uses **value-non-nullish** semantics: `{key: null}` falls through. See [D3](../../SPEC.md#config-key-value-non-nullish-rule-d3).
