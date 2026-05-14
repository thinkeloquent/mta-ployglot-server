# API Example: buildConfigFiles / build_config_files

## Goal

Public reference for the path-derivation helper.

## Signature / Contract

```ts
function buildConfigFiles(
  configDir: string,
  appEnv: string,
  baseFiles?: string[],
  envSuffixes?: string[]
): string[];
```

```python
def build_config_files(
    config_dir: str,
    app_env: str,
    base_files: list[str] | None = None,
    env_suffixes: list[str] | None = None,
) -> list[str]: ...
```

## Inputs

| Name           | Type        | Required | Description                                                   |
| -------------- | ----------- | -------- | ------------------------------------------------------------- |
| `configDir`    | `string`    | yes      | Absolute or relative directory of the YAML files.             |
| `appEnv`       | `string`    | yes      | Environment slug (e.g. `dev`, `prod`). Caller lowercases.     |
| `baseFiles`    | `string[]`  | no       | Override base file list. Default: 4 canonical files.          |
| `envSuffixes`  | `string[]`  | no       | Override env-suffix prefixes. Default: `['server','endpoint']`. |

## Outputs

Path list, base files first, env-suffixed files second. Length = `baseFiles.length + envSuffixes.length`. Paths are joined via `path.join` (mjs) / `os.path.join` (py); `..` segments are not resolved here.

## Errors / Failure modes

| Condition                    | Surface                          |
| ---------------------------- | -------------------------------- |
| `configDir` is not a string  | `TypeError` / Python type error  |

## Example

```js
buildConfigFiles('/cfg', 'prod');
// → ['/cfg/base.yml', '/cfg/security.yml', '/cfg/api-release-date.yml',
//    '/cfg/feature_flags.yml', '/cfg/server.prod.yaml', '/cfg/endpoint.prod.yaml']
```

## Notes

- This function does NOT verify file existence; it is a pure path builder. Use `loadFiles({ missing: 'skip' })` for tolerance.

## Implementation

- mjs: [`packages/mjs/src/paths.mjs`](../../packages/mjs/src/paths.mjs)
- py: [`packages/py/src/app_yaml_loader/paths.py`](../../packages/py/src/app_yaml_loader/paths.py)
