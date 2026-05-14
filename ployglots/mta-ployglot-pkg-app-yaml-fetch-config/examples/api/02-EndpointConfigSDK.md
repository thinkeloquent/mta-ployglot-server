# API Entry: EndpointConfigSDK

## Goal

Stateful wrapper around the module-level functions, with refresh + query conveniences.

## Signature / Contract

```ts
class EndpointConfigSDK {
  constructor(options?: { filePath?: string });
  loadConfig(obj: object): object;
  loadFromFile(filePath: string): object;
  refreshConfig(): object;
  getByKey(key: string): EndpointConfig | null;
  getByName(name: string): EndpointConfig | null;
  getByTag(tag: string): EndpointConfig[];
  getAll(): EndpointConfig[];
  listKeys(): string[];
  properties<T>(path: string, defaultValue?: T): T | unknown;
  resolveIntent(intent: string): { key: string; endpoint: EndpointConfig | null };
  getFetchConfig(serviceId: string, payload: unknown, customHeaders?: Record<string,string> | null): FetchConfig;
}

function createEndpointConfigSDK(options?: { filePath?: string }): EndpointConfigSDK;
```

Python: same surface, snake_case method names, plus camelCase parity aliases (`getByKey`, `loadFromFile`, …).

## Inputs / Outputs / Errors

| Method | Notes |
| ------ | ----- |
| `refreshConfig` | Throws (mjs `Error`, py `RuntimeError`) if no `filePath` set. |
| `getFetchConfig` | Throws `ConfigError` for unknown service id. |
| `getByKey` / `getByName` | Returns `null` / `None` when absent. |
| `properties` | `default` returned when any segment of dot-path is missing. |
| `resolveIntent` | Always returns `{ key, endpoint }`; `endpoint` may be `null` if the resolved key isn't in the loaded config. |

## Example

```js
const sdk = createEndpointConfigSDK({ filePath: './e.yaml' });
sdk.refreshConfig();
sdk.getByTag('llm');
```

## Notes

- All instances share the module-level `_config` — they are not isolated stores. Use `loadConfig({})` between unrelated test cases.
- Each instance keeps its own private `filePath`, so two SDKs can refresh from different files even though they read the same shared `_config` afterwards.
