# SDK Example: Engine and applier together

## Goal

Drop-in replacement for source `app_yaml_overwrites.ConfigSDK.getResolved`. Loads
a config tree (any source — JSON, YAML, hand-built dict), runs the applier with
the default engine, returns the resolved tree.

## Prerequisites

- `npm install` (mjs) or `uv sync` (py) from the repo root.
- `export GEMINI_KEY=secret` in shell.

## Config

```json
{
  "providers": {
    "gemini": {
      "api_key": null,
      "timeout": 1000,
      "overwrite_from_env": { "api_key": "GEMINI_KEY" },
      "overwrite_from_context": { "timeout": "{{env.GEMINI_TIMEOUT | \"5000\"}}" }
    }
  },
  "services": {
    "x": {
      "url": "placeholder",
      "overwrite_from_context": { "url": "{{request.host}}" }
    }
  }
}
```

## Code (mjs)

```js
import { applyOverwritesFromContext } from '@ployglot/app-yaml-from-context';

const config = JSON.parse(/* the JSON above */);
const resolved = await applyOverwritesFromContext(config, {
  context: { request: { host: 'api.example.com' } },
});

console.log('gemini.api_key:', resolved.providers.gemini.api_key);
console.log('gemini.timeout:', resolved.providers.gemini.timeout);
console.log('services.x.url:', resolved.services.x.url);
```

## Code (py)

```python
import asyncio
import json
from app_yaml_from_context import apply_overwrites_from_context

config = json.loads(__doc__)  # or load from file
resolved = asyncio.run(
    apply_overwrites_from_context(config, context={"request": {"host": "api.example.com"}})
)

print("gemini.api_key:", resolved["providers"]["gemini"]["api_key"])
print("gemini.timeout:", resolved["providers"]["gemini"]["timeout"])
print("services.x.url:", resolved["services"]["x"]["url"])
```

## Expected outcome

```
gemini.api_key: secret
gemini.timeout: 5000        # numeric — parseDefault coerces "5000" to 5000
services.x.url: api.example.com
```

## Notes

- This sequence (config → overwrite resolution) reproduces the source SDK's `getResolved` end-to-end.
- The engine is created lazily by the applier on first call; no manual wiring required.
- env section is applied **before** context section (matches source ordering).
- The applier preserves the (resolved) overwrite sections under their original keys for diagnostics.
