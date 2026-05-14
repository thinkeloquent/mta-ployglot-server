# env-resolve specification

Canonical reference for the four-tier configuration resolver and its three typed
coercion wrappers. Both the TypeScript implementation (`packages/ts/`) and the
Python implementation (`packages/py/`) MUST conform to this document. Any
divergence is a bug, not a language idiom.

## Function inventory

| Concept            | TypeScript                                                | Python                                                  |
| ------------------ | --------------------------------------------------------- | ------------------------------------------------------- |
| Generic resolver   | `resolve(arg, envKeys, config, configKey, defaultValue)`  | `resolve(arg, env_keys, config, config_key, default)`   |
| Boolean coercion   | `resolveBool(...)`                                        | `resolve_bool(...)`                                     |
| Integer coercion   | `resolveInt(...)`                                         | `resolve_int(...)`                                      |
| Float coercion     | `resolveFloat(...)`                                       | `resolve_float(...)`                                    |

## Algorithm — four-tier resolution

```
resolve(arg, envKeys, config, configKey, default):
    1. if arg is not nullish: return arg                              # tier 1
    2. if envKeys is provided:                                        # tier 2
        for each k in normalize(envKeys):
            if k is non-empty and process.env[k] is set: return env[k]
    3. if config is provided and configKey is non-nullish:            # tier 3
        v = config[configKey]; if v is not nullish: return v
    4. return default                                                 # tier 4
```

`normalize(envKeys)` is the identity for arrays and `[envKeys]` for a single
string. Each tier short-circuits on the first concrete hit; tier 4 is reached
only when every prior tier yields nullish.

## Unset-sentinel rule (D1)

Sources diverged at the tier-1 guard:

- Python (`core.py:20`): `if arg is not None`.
- TypeScript (`index.ts:17`): `if (arg !== undefined && arg !== null)`.

Canonical: a value is "unset" iff it is `None` (Python) or `null`/`undefined`
(TypeScript). Both nullish forms in JavaScript short-circuit to tier 2; Python
keeps `is not None`.

## Env-keys nullish tolerance (D7)

Sources diverged on a nullish `env_keys` / `envKeys`:

- Python (`core.py:24-27`): raised `TypeError` when iterating `None`.
- TypeScript (`index.ts:22, 28`): guarded with explicit `null` / `undefined`
  checks before iterating.

Canonical: a `None`/`null`/`undefined` value for `env_keys`/`envKeys`
short-circuits to tier 3 silently — never raises. Python adds an explicit early
return guard; TypeScript already conforms.

## Config-key value-non-nullish rule (D3)

Sources diverged on tier-3 presence:

- Python (`core.py:34`): `if config_key in config` — returned `None` when the
  key was explicitly mapped to `None`.
- TypeScript (`index.ts:35`): `if (config[configKey] !== undefined)` — already
  skipped explicit `undefined` but accepted `null`.

Canonical: `config[configKey]` is "set" iff its value is not
`None`/`null`/`undefined`. Python switches to
`config.get(config_key) is not None`; TypeScript switches to
`config[configKey] != null`.

## Boolean coercion

After `resolve(...)` returns a value, classify:

- bool → return as-is.
- string → lowercase, return `true` iff in `TRUTHY_STRINGS`, else `false`.
- number → return `value !== 0` (TS) / `value != 0` (Python) — non-zero is `true`.
- otherwise → return `Boolean(value)` / `bool(value)` fallthrough.

## Integer coercion (D4, D5)

- **D5** — bool argument → return `default`. Python guards
  `isinstance(val, bool)` *before* the integer arm because `bool` is a subclass
  of `int`.
- **D4** — string argument → match `/^-?\d+$/`; if no match return `default`;
  otherwise `parseInt(val, 10)` (TS) / `int(val)` (Python). The regex rejects
  decimal-shaped strings (`"3.14"`), scientific notation (`"1e3"`), leading `+`,
  hex prefixes, and surrounding whitespace.
- number argument → return `value` if `Number.isInteger(value)` (TS) /
  `isinstance(value, int) and not isinstance(value, bool)` (Python); else
  `default`.

## Float coercion (D6)

Sources diverged on partial-numeric strings:

- Python (`core.py:55`): `float("12abc")` raised `ValueError`, caught, returned
  `default`. Already strict.
- TypeScript (`index.ts:62`): `parseFloat("12abc")` returned `12`. Permissive.

Canonical: reject partial-numeric strings.

- string argument → `Number(val)` (TS) / `float(val)` (Python). Reject if not
  finite (`Number.isFinite` / `try/except` returns `default`).
- number argument → return `value`.
- bool argument → return `Number(value)` / `float(value)` (no D5 analog for
  floats; this is a deliberate asymmetry).

## Truthy strings

Module-level constant; consumed by both the bool coercion and the parity
fixtures:

- TypeScript: `export const TRUTHY_STRINGS = ['true', '1', 'yes', 'on'] as const;`
- Python: `TRUTHY_STRINGS: tuple[str, ...] = ("true", "1", "yes", "on")`

String comparison is case-insensitive: `val.toLowerCase()` (TS) / `val.lower()`
(Python).

## Cross-language naming map

| Concept              | Python          | TypeScript     |
| -------------------- | --------------- | -------------- |
| Bool coercion fn     | `resolve_bool`  | `resolveBool`  |
| Int coercion fn      | `resolve_int`   | `resolveInt`   |
| Float coercion fn    | `resolve_float` | `resolveFloat` |
| 2nd param            | `env_keys`      | `envKeys`      |
| 4th param            | `config_key`    | `configKey`    |
| 5th param            | `default`       | `defaultValue` |
