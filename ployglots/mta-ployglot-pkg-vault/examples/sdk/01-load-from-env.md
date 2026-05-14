# SDK Scenario 01 — Load From Env

## Goal

Build an SDK instance via the fluent builder, call `loadConfig()`, and print
the resulting `LoadResult` JSON payload.

## Prerequisites

- `@polyglot/vault-file` installed (TS) or `polyglot-vault-file` installed (py).
- A `.env` file present at the CWD (missing file is handled gracefully — the
  store stays empty, `totalVarsLoaded` reflects just `process.env`).

## Code

TypeScript (`packages/ts/examples/sdk/01-load-from-env.mjs`):

```js
import { VaultFileSDK } from '@polyglot/vault-file';

const sdk = VaultFileSDK.create().withEnvPath('.env').build();
const result = sdk.loadConfig();
if (!result.success) {
  console.error('load failed:', result.error);
  process.exit(1);
}
console.log(JSON.stringify(result.data));
```

Python (`packages/py/examples/sdk/01_load_from_env.py`):

```python
from polyglot_vault_file import VaultFileSDK

sdk = VaultFileSDK.create().with_env_path(".env").build()
result = sdk.load_config()
if not result.success:
    print(f"load failed: {result.error}")
    raise SystemExit(1)
print(result.data.model_dump_json(by_alias=True))
```

## Expected output

```json
{"totalVarsLoaded": 42}
```

(Numeric value differs per environment; key name is always `totalVarsLoaded`
— camelCase on both twins.)

## Notes

- `onStartup` is synchronous on both twins; no `await` required on TS.
- `loadConfig` wraps the underlying `EnvStore.onStartup` — failures are
  reported via `SDKResult.error` rather than thrown.
