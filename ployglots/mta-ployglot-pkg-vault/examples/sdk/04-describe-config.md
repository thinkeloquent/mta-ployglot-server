# SDK Scenario 04 — Describe Config

## Goal

After `loadConfig`, call `describeConfig` and print the descriptor. This
scenario visibly exercises the 1.0.0 bug fix — `varsCount` now reports the
real count from `EnvStore`, not a hardcoded zero.

## Code

TypeScript (`packages/ts/examples/sdk/04-describe-config.mjs`):

```js
import { VaultFileSDK } from '@polyglot/vault-file';

const sdk = VaultFileSDK.create().withEnvPath(process.argv[2] ?? '.env').build();
sdk.loadConfig();
const r = sdk.describeConfig();
console.log(JSON.stringify(r.data, null, 2));
```

Python (`packages/py/examples/sdk/04_describe_config.py`):

```python
import sys
from polyglot_vault_file import VaultFileSDK

env_path = sys.argv[1] if len(sys.argv) > 1 else ".env"
sdk = VaultFileSDK.create().with_env_path(env_path).build()
sdk.load_config()
r = sdk.describe_config()
print(r.data.model_dump_json(indent=2, by_alias=True))
```

## Expected output

```json
{
  "version": "1.0.0",
  "varsCount": 45,
  "source": ".env"
}
```

## Notes

- Wire-format field name is **`varsCount`** on both twins (camelCase via
  pydantic alias on py).
- Pre-1.0.0 the py source hardcoded `vars_count: 0` and the mjs source
  bracketed into the store private field — both are now reading through
  `EnvStore._getTotalVarsLoaded()`.
