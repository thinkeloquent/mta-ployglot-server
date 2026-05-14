# API — `VaultFileSDK.validateFile`

## Goal

Parse a dotenv-format file and report validation outcome without mutating the
env store.

## Signature / Contract

```ts
// TS
validateFile(filePath: string): SDKResult<ValidationResult>
```

```python
# Py
def validate_file(self, file_path: str) -> SDKResult
```

## Inputs

| Name        | Type   | Required | Description                                     |
| ----------- | ------ | -------- | ----------------------------------------------- |
| `filePath`  | string | yes      | Path to the file to validate.                   |

## Outputs

`SDKResult<ValidationResult>`:

```ts
{
  success: true,
  data: {
    valid: boolean,
    errors: string[],
    warnings: string[],
  }
}
```

`success` is always `true` — `validateFile` does not fail via `SDKResult`.
Validation outcome lives on `data.valid`.

## Errors / Failure modes

- `errors` is non-empty when the underlying parse throws (e.g. passing a
  directory path surfaces `EISDIR`).
- `warnings` includes `"file parsed to empty map"` when the file is missing
  or contains no key=value lines.

## Example

```ts
const r = sdk.validateFile('/etc/app/.env');
if (!r.data.valid) console.error(r.data.errors.join('\n'));
```

```python
r = sdk.validate_file("/etc/app/.env")
if not r.data.valid:
    print("\n".join(r.data.errors))
```

## Notes

- Idempotent — no side effects on the env store.
- Useful as a pre-deploy config check; pair with `describeConfig` for a
  fuller picture.
