# SDK Scenario 03 — Validate File

## Goal

Validate a `.env`-format file without loading it into the env store. Prints
the full `ValidationResult` including warnings for empty files.

## Code

TypeScript (`packages/ts/examples/sdk/03-validate-file.mjs`):

```js
import { VaultFileSDK } from '@polyglot/vault-file';
const sdk = VaultFileSDK.create().build();
const r = sdk.validateFile(process.argv[2] ?? '/tmp/missing.env');
console.log(JSON.stringify(r.data, null, 2));
```

Python (`packages/py/examples/sdk/03_validate_file.py`):

```python
import sys
from polyglot_vault_file import VaultFileSDK

sdk = VaultFileSDK.create().build()
path = sys.argv[1] if len(sys.argv) > 1 else "/tmp/missing.env"
r = sdk.validate_file(path)
print(r.data.model_dump_json(indent=2))
```

## Expected output

Missing file:

```json
{
  "valid": true,
  "errors": [],
  "warnings": ["file parsed to empty map"]
}
```

Directory (forces parse error):

```json
{
  "valid": false,
  "errors": ["EISDIR: illegal operation on a directory, read"],
  "warnings": []
}
```

## Notes

- `validateFile` never throws — all failures land in `errors` / `warnings`.
- `success` on `SDKResult` is `true` even when `data.valid` is `false`; the
  two flags distinguish transport failure (`success: false`) from validation
  failure (`data.valid: false`).
