# API — `EnvStore.get`

## Goal

Look up a key with vault-wins priority. Returns the value if present in the
loaded store; falls back to `process.env` (TS) / `os.environ` (py); finally
returns the `defaultValue` argument.

## Signature / Contract

```ts
// TS
static get(key: string, defaultValue?: string): string | undefined
```

```python
# Py
@classmethod
def get(cls, key: str, default: Optional[str] = None) -> Optional[str]
```

## Inputs

| Name           | Type              | Required | Default     | Description                                     |
| -------------- | ----------------- | -------- | ----------- | ----------------------------------------------- |
| `key`          | string            | yes      | —           | The environment variable name to look up.       |
| `defaultValue` / `default` | string  | no       | `undefined` / `None` | Value returned when neither store nor env has the key. |

## Outputs

- The stored value (string) if `key` is in the internal store.
- Else the `process.env` / `os.environ` value if set.
- Else the `defaultValue` argument.
- Else `undefined` / `None`.

## Errors / Failure modes

None — `get` never throws. Use `getOrThrow` when a missing key is a fatal
configuration error.

## Example

```ts
process.env.SHARED = 'from-env';
EnvStore.onStartup('.env.with-SHARED');   // file also defines SHARED
console.log(EnvStore.get('SHARED'));       // "file-value" — vault wins
console.log(EnvStore.get('MISSING', 'x')); // "x" — default fallback
```

```python
os.environ["SHARED"] = "from-env"
EnvStore.on_startup(".env.with-SHARED")
print(EnvStore.get("SHARED"))          # "file-value"
print(EnvStore.get("MISSING", "x"))    # "x"
```

## Notes

- **vault-wins priority order** is a deliberate, breaking change vs. the
  pre-1.0.0 TS source. The py source was already vault-wins; the two twins
  now agree.
- A caller that wants the previous `process.env` → store order should read
  `process.env[key]` directly before falling back to `EnvStore.get`.
