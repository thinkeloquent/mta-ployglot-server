# API Example: AppYamlConfig

## Goal

Singleton config store with deep-merged tree + per-file originals + immutable mutators.

## Signature / Contract

```ts
class AppYamlConfig {
  static initialize(options: {
    loaded?: Map<string, object>;
    files?: string[];          // requires app-yaml-loader
    configDir?: string;        // requires app-yaml-loader
    appEnv?: string;
    logger?: ILogger;
  }): Promise<AppYamlConfig>;

  static getInstance(): AppYamlConfig;
  static _resetForTesting(): void;

  get<T>(key: string, defaultValue?: T): T | undefined;
  getNested<T>(keys: string[], defaultValue?: T): T | undefined;
  getAll(): Record<string, unknown>;
  getGlobalAppConfig(): Record<string, unknown>;
  getOriginal(file: string): Record<string, unknown> | undefined;
  getOriginalAll(): Map<string, Record<string, unknown>>;
  restore(): void;

  set(...): never;     // throws ImmutabilityError
  update(...): never;
  reset(): never;
  clear(): never;
}
```

## Inputs / Outputs / Errors

| Method | Returns | Errors |
| ------ | ------- | ------ |
| `initialize` | Singleton instance | Missing required input → `Error`; Loader missing on compat path → `Error` naming `app-yaml-loader` |
| `getInstance` | Singleton instance | Pre-init → `Error('AppYamlConfig not initialized')` |
| Reader methods | Deep-cloned values | None |
| Mutator methods | — | `ImmutabilityError` always |

## Example

```js
await AppYamlConfig.initialize({ loaded });
const cfg = AppYamlConfig.getInstance();
cfg.get('providers');            // deep-cloned object
cfg.set('x', 1);                 // throws ImmutabilityError
```

## Notes

- Singleton state is process-local; reset between tests via `_resetForTesting()`.
