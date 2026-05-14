# API — `EnvStore.getOrThrow`

## Goal

Required-key lookup. Raises a typed error if the key is absent from both the
loaded store and the process environment.

## Signature / Contract

```ts
// TS
static getOrThrow(key: string): string
```

```python
# Py
@classmethod
def get_or_throw(cls, key: str) -> str
```

## Inputs

| Name  | Type   | Required | Description                               |
| ----- | ------ | -------- | ----------------------------------------- |
| `key` | string | yes      | Environment variable name. Must be non-empty. |

## Outputs

The resolved string value.

## Errors / Failure modes

| Condition          | Error type (TS) | Error type (py)         | Message                                 |
| ------------------ | --------------- | ----------------------- | --------------------------------------- |
| Empty key          | `Error`         | `ValueError`            | `"Key is required"`                     |
| Key absent         | `EnvKeyNotFoundError` | `EnvKeyNotFoundError` | `"Environment variable '<key>' not found"` |

Both `EnvKeyNotFoundError` instances expose `.key` — the missing name is
preserved on the exception.

## Example

```ts
try {
  const v = EnvStore.getOrThrow('DATABASE_URL');
} catch (err) {
  if (err instanceof EnvKeyNotFoundError) {
    console.error('missing:', err.key);
  }
}
```

```python
try:
    v = EnvStore.get_or_throw("DATABASE_URL")
except EnvKeyNotFoundError as err:
    print("missing:", err.key)
```

## Notes

- The message format is canonical on both twins: `"Environment variable
  '{key}' not found"` — no punctuation drift.
- `getOrThrow` uses the vault-wins priority from `get`.
