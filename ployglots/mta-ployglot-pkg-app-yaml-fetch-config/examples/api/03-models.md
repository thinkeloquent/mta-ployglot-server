# API Entry: Models

## Goal

Pure data factories for the two shapes the package emits.

## Signature / Contract

```ts
interface EndpointConfig {
  key: string;
  name: string;        // defaults to key
  tags: string[];
  baseUrl: string;     // accepts legacy alias `baseurl`
  description: string;
  method: string;      // default 'POST'
  headers: Record<string, string>;
  timeout: number;     // default 30000
  bodyType: 'json' | 'text';   // default 'json'
}

function createEndpointConfig(data: object, key?: string): EndpointConfig;

interface FetchConfig {
  serviceId: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
  headersTimeout: number;   // renamed from input `timeout`
}

function createFetchConfig(opts: {
  serviceId: string; url: string; method: string;
  headers: Record<string, string>; body: string; timeout: number;
}): FetchConfig;
```

Python: `create_endpoint_config(data, key="")` and `create_fetch_config(*, serviceId, url, method, headers, body, timeout)`. Both return plain `dict` instances. CamelCase aliases (`createEndpointConfig`, `createFetchConfig`) are also exported.

## Defaults table

| Field      | Default   | Source                |
| ---------- | --------- | --------------------- |
| `name`     | `key`     | FC unified spec       |
| `tags`     | `[]`      | deep-cloned           |
| `method`   | `POST`    | FC5                   |
| `headers`  | `{}`      | deep-cloned           |
| `timeout`  | `30000`   | FC4                   |
| `bodyType` | `json`    | FC unified spec       |
| `baseUrl`  | `''`      | FC6 (legacy `baseurl` accepted) |

## Errors / Failure modes

Neither factory throws. Both are pure — input is not mutated.

## Notes

- `createEndpointConfig` accepts both `baseUrl` (preferred) and `baseurl` (legacy alias), with `baseUrl` winning when both are present.
- `createFetchConfig` renames the input `timeout` to `headersTimeout` in its output. The shape is identical across Node and Python.
