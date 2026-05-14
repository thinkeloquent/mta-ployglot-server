# API — `VaultFileSDK.create()` / Builder

## Goal

Construct a `VaultFileSDK` via a fluent builder with optional env-path,
base64 parsers, and logger injection.

## Signature / Contract

```ts
// TS
static VaultFileSDK.create(): VaultFileSDKBuilder

class VaultFileSDKBuilder {
  withEnvPath(path: string): VaultFileSDKBuilder
  withBase64Parsers(parsers: Record<string, (s: string) => string>): VaultFileSDKBuilder
  withLogger(logger: IVaultFileLogger): VaultFileSDKBuilder
  build(): VaultFileSDK
}
```

```python
# Py
class VaultFileSDK:
    @classmethod
    def create(cls) -> VaultFileSDKBuilder: ...

class VaultFileSDKBuilder:
    def with_env_path(self, path: str) -> VaultFileSDKBuilder: ...
    def with_base64_parsers(self, parsers: Dict[str, Callable[[str], str]]) -> VaultFileSDKBuilder: ...
    def with_logger(self, logger: IVaultFileLogger) -> VaultFileSDKBuilder: ...
    def build(self) -> VaultFileSDK: ...
```

## Inputs

| Step                    | Required | Default                          |
| ----------------------- | -------- | -------------------------------- |
| `withEnvPath`           | no       | `.env` at `loadConfig` call time |
| `withBase64Parsers`     | no       | `{}`                             |
| `withLogger`            | no       | module default `Logger.create('vault-file','sdk')` |

## Outputs

A `VaultFileSDK` instance. Ready to call `loadConfig`, `validateFile`,
`describeConfig`, etc.

## Errors / Failure modes

`build()` never throws. Misconfiguration (e.g. a bogus `envPath`) surfaces
later via `SDKResult.error` from `loadConfig`.

## Example

```ts
const sdk = VaultFileSDK.create()
  .withEnvPath('/etc/app/.env')
  .withLogger(myLogger)
  .build();
```

```python
sdk = (
    VaultFileSDK.create()
    .with_env_path("/etc/app/.env")
    .with_logger(my_logger)
    .build()
)
```

## Notes

- **`withLogger` is new on TS in 1.0.0.** Previously the SDK hard-coded
  `Logger.create('vault-file','sdk')`; TS callers that inspected log output
  had to swap the underlying console. The signature now matches the py twin
  bilaterally.
- The pre-1.0.0 mjs source used `@ts-ignore` to reach `VaultFileSDK`'s
  private constructor from the builder; the new internal factory
  `VaultFileSDK.newForBuilder()` replaces that. Consumers don't need to
  change anything — the `withLogger` call is the only visible API delta.
