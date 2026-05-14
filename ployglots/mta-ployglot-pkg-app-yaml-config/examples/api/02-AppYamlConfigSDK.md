# API Example: AppYamlConfigSDK

## Goal

Thin façade over `AppYamlConfig` with dot-path getter and list helpers.

## Signature / Contract

```ts
class AppYamlConfigSDK {
  constructor(config: AppYamlConfig);
  static fromDirectory(configDir: string): Promise<AppYamlConfigSDK>;

  get<T>(path: string, defaultValue?: T): T | undefined;   // dot-path
  getAll(): Record<string, unknown>;
  listProviders(): string[];
  listServices(): string[];
  listStorages(): string[];
}
```

## Inputs / Outputs / Errors

| Method | Returns | Errors |
| ------ | ------- | ------ |
| `fromDirectory` | SDK instance | Loader missing → `Error` naming `app-yaml-loader` |
| `get(path)` | Value at dot-path or default | None |
| `list*` | `string[]` | None |

## Example

```js
const sdk = await AppYamlConfigSDK.fromDirectory('./fixtures');
sdk.listProviders();           // ['gemini', 'openai']
sdk.get('providers.gemini.api_key', '(none)');
```

## Notes

- Wraps a singleton; multiple SDK instances share state.
