# API Example: Merge functions

## Goal

Three pure functions usable standalone (no singleton state).

## Signature / Contract

```ts
function deepMerge<T extends object>(base: T, override: Partial<T>): T;
function mergeFiles(loaded: Map<string, object>): Record<string, unknown>;
function mergeGlobalIntoProviders(merged: Record<string, unknown>): Record<string, unknown>;
```

## Inputs / Outputs

| Function | Returns | Notes |
| -------- | ------- | ----- |
| `deepMerge` | New deep-cloned object | Arrays replace, objects recurse, primitives replace |
| `mergeFiles` | Merged object (or `{}` if input empty) | Iteration order = priority |
| `mergeGlobalIntoProviders` | Cloned object with provider defaults filled in | No-op when `global` or `providers` absent/empty |

## Example

```js
import { deepMerge, mergeFiles, mergeGlobalIntoProviders } from '@ployglot/app-yaml-config';

const merged = mergeFiles(loaded);
const final = mergeGlobalIntoProviders(merged);
```

## Notes

- These are the building blocks of `AppYamlConfig.initialize`. Exposed for callers that want a non-singleton path.
