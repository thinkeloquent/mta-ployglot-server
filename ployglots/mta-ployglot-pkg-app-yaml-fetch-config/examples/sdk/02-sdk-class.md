# SDK Example: SDK class with refresh

## Goal

Use `EndpointConfigSDK` for a stateful workflow: load from file, query by tag, refresh after the YAML is edited.

## Prerequisites

- [`examples/fixtures/endpoint.yaml`](../fixtures/endpoint.yaml) populated with at least 2 endpoints, both tagged `llm`.

## Code (Node)

```js
import { createEndpointConfigSDK } from '@ployglot/app-yaml-fetch-config';

const sdk = createEndpointConfigSDK({ filePath: './examples/fixtures/endpoint.yaml' });
sdk.refreshConfig();

const llmEndpoints = sdk.getByTag('llm');
console.log('llm endpoints:', llmEndpoints.map(e => e.key));

const { key, endpoint } = sdk.resolveIntent('storybook');
console.log('storybook intent →', key);

const fetchCfg = sdk.getFetchConfig(key, { prompt: 'go' });
console.log(fetchCfg.url);
```

## Code (Python)

```python
from app_yaml_fetch_config import create_endpoint_config_sdk

sdk = create_endpoint_config_sdk({"filePath": "./examples/fixtures/endpoint.yaml"})
sdk.refresh_config()

llm_endpoints = sdk.get_by_tag("llm")
print("llm endpoints:", [e["key"] for e in llm_endpoints])

resolved = sdk.resolve_intent("storybook")
print("storybook intent →", resolved["key"])

fetch_cfg = sdk.get_fetch_config(resolved["key"], {"prompt": "go"})
print(fetch_cfg["url"])
```

## Expected outcome

```
llm endpoints: [ 'llm001', 'llm002' ]
storybook intent → llm002
https://api.alt.com/v1/chat
```

## Notes

- `refreshConfig()` re-reads the YAML; useful after a file edit (no file watcher built-in).
- `getByTag` returns an array; the order matches the YAML's insertion order.
- Multiple SDK instances share the module-level `_config` — they are not isolated stores.
