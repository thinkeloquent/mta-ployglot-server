# API Entry: getFetchConfig

## Goal

Build an HTTP fetch ARGS object for a service id.

## Signature / Contract

```ts
function getFetchConfig(
  serviceId: string,
  payload: unknown,
  customHeaders?: Record<string, string> | null
): FetchConfig;

interface FetchConfig {
  serviceId: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
  headersTimeout: number;
}
```

Python signature (snake_case):

```python
def get_fetch_config(
    service_id: str,
    payload: Any,
    custom_headers: dict | None = None,
) -> dict: ...
```

## Inputs

| Name           | Type     | Required | Description                                          |
| -------------- | -------- | -------- | ---------------------------------------------------- |
| `serviceId`    | string   | yes      | Service id; `endpoints.` prefix accepted (FC2).      |
| `payload`      | unknown  | yes      | Body content; serialized per the endpoint's `bodyType`. |
| `customHeaders`| object   | no       | Headers that override endpoint headers.              |

## Outputs

`FetchConfig` ready for `fetch(url, { method, headers, body, ... })`.

## Errors / Failure modes

| Condition          | Surface                                      |
| ------------------ | -------------------------------------------- |
| Service unknown    | `ConfigError(message, serviceId, available)` |
| Config not loaded  | `ConfigError('Configuration not loaded.')`   |

## Header composition (FC3)

Merge order: defaults → endpoint headers → custom headers.

```
{ 'Content-Type': 'application/json' }
  ← endpoint.headers
  ← customHeaders
```

Custom headers always win.

## Body composition

| `bodyType` | Result                |
| ---------- | --------------------- |
| `'text'`   | `String(payload)`     |
| `'json'` (default) | `JSON.stringify(payload)` |

## Example

```js
import { loadConfig, getFetchConfig } from '@ployglot/app-yaml-fetch-config';

loadConfig({ endpoints: { llm001: { baseUrl: 'https://api.example.com', method: 'POST' } } });
const cfg = getFetchConfig('llm001', { prompt: 'Hi' }, { 'X-Trace-Id': 'abc' });
await fetch(cfg.url, cfg);
```

## Notes

- `headersTimeout` is the Node `fetch` field name; some HTTP clients want plain `timeout`.
