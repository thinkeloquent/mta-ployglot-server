# API — `VaultFileSDK.getSecretSafe`

## Goal

Return a masked view of a stored secret plus an existence flag. Never
discloses the underlying value.

## Signature / Contract

```ts
// TS
getSecretSafe(key: string): SDKResult<SecretInfo>
```

```python
# Py
def get_secret_safe(self, key: str) -> SDKResult
```

## Inputs

| Name  | Type   | Required | Description                     |
| ----- | ------ | -------- | ------------------------------- |
| `key` | string | yes      | Key to look up in the env store. |

## Outputs

On success:

```ts
{
  success: true,
  data: { key: string, masked: "***", exists: true }
}
```

On miss:

```ts
{
  success: false,
  error: { code: "KEY_NOT_FOUND", message: "key '<key>' not present" }
}
```

## Errors / Failure modes

The miss path is the only failure. `error.code` is always `"KEY_NOT_FOUND"`
on this method; any other code indicates a caller bug.

Related codes produced by sibling SDK methods:

- `LOAD_FAILED` — returned by `loadConfig` / `loadFromPath` when
  `EnvStore.onStartup` throws.
- `NOT_IMPLEMENTED` — returned by the three stubs (`exportToFormat`,
  `listAvailableKeys`, `suggestMissingKeys`).

## Example

```ts
const r = sdk.getSecretSafe('DB_PASSWORD');
if (r.success) {
  console.log('have DB_PASSWORD:', r.data.masked);  // "***"
} else if (r.error?.code === 'KEY_NOT_FOUND') {
  console.log('not configured');
}
```

```python
r = sdk.get_secret_safe("DB_PASSWORD")
if r.success:
    print("have DB_PASSWORD:", r.data.masked)
elif r.error and r.error.code == "KEY_NOT_FOUND":
    print("not configured")
```

## Notes

- The masked value is always `"***"` — no partial reveal.
- For a plaintext lookup use `EnvStore.get(key)` directly, understanding
  that the result is an ordinary string.
