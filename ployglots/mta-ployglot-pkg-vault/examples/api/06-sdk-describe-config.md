# API — `VaultFileSDK.describeConfig`

## Goal

Return a descriptor of the current env-store state: version tag, real
`varsCount`, and the source path.

## Signature / Contract

```ts
// TS
describeConfig(): SDKResult<ConfigDescription>
```

```python
# Py
def describe_config(self) -> SDKResult
```

## Inputs

None.

## Outputs

`SDKResult<ConfigDescription>`:

```ts
{
  success: true,
  data: {
    version: string,     // package version, "1.0.0" in this release
    varsCount: number,   // real count from EnvStore._getTotalVarsLoaded()
    source: string,      // the envPath the SDK was built with, or ".env"
  }
}
```

Wire-format field name is **`varsCount`** on both twins (pydantic alias on
py).

## Errors / Failure modes

None — `describeConfig` always returns `success: true`.

## Example

```ts
const r = sdk.describeConfig();
console.log(`${r.data.varsCount} vars from ${r.data.source}`);
```

```python
r = sdk.describe_config()
print(f"{r.data.vars_count} vars from {r.data.source}")
```

## Notes

- **Bug fix in 1.0.0**: both surveyed twins previously reported
  `varsCount: 0` / `vars_loaded: 0` (hard-coded). This release reads through
  `EnvStore._getTotalVarsLoaded()` / `EnvStore._get_total_vars_loaded()`.
- Call after `loadConfig` to get meaningful numbers; pre-load it will return
  whatever the singleton's internal counter is (usually 0).
