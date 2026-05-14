# Twin Drift Catalog

Source of truth: [`/SPEC.md`](../SPEC.md). The fixtures at [`/tests/parity/fixtures.json`](../tests/parity/fixtures.json) execute every aligned drift on both sides; if either port deviates, that side's local test fails.

## Pair: env-resolve (ts) ↔ env-resolve (py)

Both ports implement the same five-function surface (`resolve` + three coercion wrappers + `TRUTHY_STRINGS`). Naming differs by language convention; behavior is identical by spec.

### Surface

| Concept            | TypeScript                                                     | Python                                                  |
| ------------------ | -------------------------------------------------------------- | ------------------------------------------------------- |
| Generic resolver   | `resolve(arg, envKeys, config, configKey, defaultValue)`       | `resolve(arg, env_keys, config, config_key, default)`   |
| Bool coercion      | `resolveBool(...)`                                             | `resolve_bool(...)`                                     |
| Int coercion       | `resolveInt(...)`                                              | `resolve_int(...)`                                      |
| Float coercion     | `resolveFloat(...)`                                            | `resolve_float(...)`                                    |
| Truthy constant    | `TRUTHY_STRINGS = ['true','1','yes','on'] as const`            | `TRUTHY_STRINGS: tuple[str, ...] = ("true","1","yes","on")` |

### Aligned drifts

These six caller-visible drifts existed between the two original source packages. The canonical spec picks one rule; both ports conform.

| ID  | Concern                              | Canonical rule                                                                  | Side that needed the change |
|-----|--------------------------------------|---------------------------------------------------------------------------------|-----------------------------|
| D1  | `arg` "unset" sentinel               | `arg` is unset iff nullish (`None` / `null` / `undefined`).                     | Both already conform.       |
| D3  | Config-key presence                  | `config[key]` is "set" iff its value is **not nullish** — `{key: null}` skips. | py: switched from `key in config` to `config.get(key) is not None`. ts: added explicit `null` skip. |
| D4  | `int` of decimal-shaped string       | Reject — `"3.14"` falls back to default.                                        | ts: added `/^-?\d+$/` regex gate before `parseInt`. py already conformed.       |
| D5  | `int` of bool argument               | Reject — `true` / `True` falls back to default.                                 | py: explicit `isinstance(val, bool)` guard *before* the `isinstance(val, int)` arm (since `bool` subclasses `int`). ts already conformed. |
| D6  | `float` of partial-numeric string    | Reject — `"12abc"` falls back to default.                                       | ts: swapped lenient `parseFloat` for `Number(val)` + `Number.isFinite`. py already conformed. |
| D7  | `env_keys` / `envKeys` = nullish     | Tolerate — short-circuit to config tier; never raise.                           | py: explicit early-return guard. ts already conformed.                          |

D2 and D8 from the source extract converged in practice and required no code change.

### Intentional asymmetries

- **Env transport.** TS reads via `process.env[k]`; Python via `os.getenv(k)`. Same observable shape (`string | undefined` vs `str | None`), but the function-call boundary differs.
- **Float-of-bool.** Both ports return `1.0` / `0.0` for `True` / `False` under `resolveFloat` / `resolve_float`. There is no D5 analog for floats — the spec deliberately keeps this path permissive while integer coercion is strict.
- **Numeric typing in Python.** `resolve_int`'s `isinstance(val, int)` arm runs *after* the bool guard, so a `True` input is rejected (default returned) rather than silently coerced to `1`. The TS side gets this for free since `typeof true === 'boolean'` is distinct from `'number'`.

### Drift watch

Any future change to a coercion rule MUST update [`/tests/parity/fixtures.json`](../tests/parity/fixtures.json) in the same change. The parity suite is the contract; if the fixture and the implementation diverge, both sides flag it locally.
