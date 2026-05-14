# SDK Scenario 02 — Load From Path

## Goal

Override the default `.env` path and load from an arbitrary location.

## Prerequisites

- A `.env`-format file at the path you plan to pass.

## Code

TypeScript (`packages/ts/examples/sdk/02-load-from-path.mjs`):

```js
import { VaultFileSDK } from '@polyglot/vault-file';
const sdk = VaultFileSDK.create().build();
const r = sdk.loadFromPath(process.argv[2] ?? './.env');
console.log(r.success ? JSON.stringify(r.data) : r.error);
```

Python (`packages/py/examples/sdk/02_load_from_path.py`):

```python
import sys
from polyglot_vault_file import VaultFileSDK

sdk = VaultFileSDK.create().build()
path = sys.argv[1] if len(sys.argv) > 1 else "./.env"
r = sdk.load_from_path(path)
print(r.data.model_dump_json(by_alias=True) if r.success else r.error)
```

## Expected output

```json
{"totalVarsLoaded": 45}
```

## Notes

- Passing a directory path produces `SDKResult { success: false, error.code: "LOAD_FAILED" }` — the filesystem error is captured in `error.message`.
