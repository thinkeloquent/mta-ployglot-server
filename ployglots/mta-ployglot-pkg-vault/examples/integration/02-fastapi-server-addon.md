# Integration Scenario 02 — FastAPI Addon

## Goal

Python twin of the Fastify addon. Registers with
`@ployglot/fastapi-server`-bootstrap via its addon list during the
`on_init` lifecycle phase.

## Addon signature

`examples/integration/fixtures/env_store_addon.py` conforms to the
`fastapi_server/.agents/addon-author.md` contract: `def env_store_addon(ctx:
Any) -> Dict[str, Any]`. Like the TS twin, the signature is vendored — no
import from the bootstrap package.

```python
from examples.integration.fixtures.env_store_addon import env_store_addon

# In the consumer's bootstrap config:
ADDONS = [env_store_addon]
```

## Runtime config

- `VAULT_ENV_PATH` — path to the `.env` file. Default `.env`.
- Lifecycle phase: `on_init`. Must not be registered as a request route.

## Expected `LoaderReport` shape

Success:

```json
{ "addon": "env_store", "totalVarsLoaded": 45 }
```

Failure:

```json
{ "addon": "env_store", "message": "Environment file path is required" }
```

## Notes

- `EnvStore.on_startup` is synchronous — safe to call from the `on_init`
  sync path without awaiting.
- The py wire-format field is `totalVarsLoaded` (camelCase) — matches the
  TS twin for cross-language reports.
