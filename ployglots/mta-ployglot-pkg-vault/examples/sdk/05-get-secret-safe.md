# SDK Scenario 05 — Get Secret Safe

## Goal

Fetch a masked secret from the loaded store and show the "not-found" error
path alongside it.

## Code

TypeScript (`packages/ts/examples/sdk/05-get-secret-safe.mjs`):

```js
import { VaultFileSDK } from '@polyglot/vault-file';

const sdk = VaultFileSDK.create()
  .withEnvPath('packages/ts/tests/fixtures/.env.mixed')
  .build();
sdk.loadConfig();
console.log('known:', JSON.stringify(sdk.getSecretSafe('SHARED')));
console.log('missing:', JSON.stringify(sdk.getSecretSafe('NOT_PRESENT')));
```

Python (`packages/py/examples/sdk/05_get_secret_safe.py`):

```python
from polyglot_vault_file import VaultFileSDK

sdk = VaultFileSDK.create().with_env_path("packages/py/tests/fixtures/.env.mixed").build()
sdk.load_config()
print("known:", sdk.get_secret_safe("SHARED").model_dump_json())
print("missing:", sdk.get_secret_safe("NOT_PRESENT").model_dump_json())
```

## Expected output

```
known: {"success":true,"data":{"key":"SHARED","masked":"***","exists":true}}
missing: {"success":false,"error":{"code":"KEY_NOT_FOUND","message":"key 'NOT_PRESENT' not present"}}
```

## Notes

- Masked value is always `"***"` — the SDK never discloses the underlying
  secret via this method.
- The known-key path returns `success: true`; the missing-key path returns
  `success: false` with `error.code: "KEY_NOT_FOUND"`.
