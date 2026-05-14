# API Examples

The public surface contract of `@polyglot/vault-file` and
`polyglot-vault-file`.

## Surface kind

Synchronous class methods and module-level functions. The TS twin is ESM
(Node ≥ 20); the py twin targets Python ≥ 3.11.

## Entries

| #   | Entry                                                             | Description                                |
| --- | ----------------------------------------------------------------- | ------------------------------------------ |
| 01  | [EnvStore.onStartup](01-env-store-on-startup.md)                  | Initialize the singleton from a .env file. |
| 02  | [EnvStore.get](02-env-store-get.md)                               | Vault-wins key lookup.                     |
| 03  | [EnvStore.getOrThrow](03-env-store-get-or-throw.md)               | Required-key lookup with typed error.      |
| 04  | [VaultFileSDK.create() / builder](04-sdk-builder.md)              | Fluent builder with `withLogger`.          |
| 05  | [VaultFileSDK.validateFile](05-sdk-validate-file.md)              | Result-based file validation.              |
| 06  | [VaultFileSDK.describeConfig](06-sdk-describe-config.md)          | Descriptor with real `varsCount`.          |
| 07  | [VaultFileSDK.getSecretSafe](07-sdk-get-secret-safe.md)           | Masked secret lookup.                      |
| 08  | [parseEnvFile](08-core-parse-env-file.md)                         | Standalone dotenv parser.                  |
