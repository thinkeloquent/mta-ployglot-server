# SDK Example: Module-level usage

## Goal

Load a config object directly and produce a `FetchConfig` for one service id.

## Prerequisites

- mjs package installed (`cd packages/mjs && make install`); no env vars required.
- For Python: `cd packages/py && make install`.

## Code (Node)

```js
import { loadConfig, getFetchConfig } from '@ployglot/app-yaml-fetch-config';

loadConfig({
  endpoints: {
    llm001: {
      name: 'Gemini OpenAI',
      tags: ['llm'],
      baseUrl: 'https://api.example.com/v1/chat',
      method: 'POST',
      headers: { Authorization: 'Bearer XYZ' },
      timeout: 8000,
      bodyType: 'json',
    },
  },
  intent_mapping: { default_intent: 'llm001', mappings: {} },
});

const cfg = getFetchConfig('llm001', { prompt: 'Hello' });
console.log(cfg);
```

## Code (Python)

```python
from app_yaml_fetch_config import load_config, get_fetch_config

load_config({
    "endpoints": {
        "llm001": {
            "name": "Gemini OpenAI",
            "tags": ["llm"],
            "baseUrl": "https://api.example.com/v1/chat",
            "method": "POST",
            "headers": {"Authorization": "Bearer XYZ"},
            "timeout": 8000,
            "bodyType": "json",
        },
    },
    "intent_mapping": {"default_intent": "llm001", "mappings": {}},
})

cfg = get_fetch_config("llm001", {"prompt": "Hello"})
print(cfg)
```

## Expected outcome

```
{
  serviceId: 'llm001',
  url: 'https://api.example.com/v1/chat',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer XYZ' },
  body: '{"prompt":"Hello"}',
  headersTimeout: 8000,
}
```

(Python prints the equivalent dict — body has spaces after `:` and `,` because `json.dumps` uses default separators.)

## Notes

- `headersTimeout` matches Node `fetch` naming.
- Pass directly to `await fetch(cfg.url, cfg)` in Node — `fetch` understands the field.
- In Python, remap to `httpx.Timeout` or `requests.Session.timeout` as needed.
