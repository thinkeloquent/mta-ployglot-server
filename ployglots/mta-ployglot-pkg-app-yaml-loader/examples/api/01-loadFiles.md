# API Example: loadFiles / load_files

## Goal

Public reference for the loader's primary primitive.

## Signature / Contract

```ts
async function loadFiles(
  paths: string[],
  options?: { missing?: 'raise' | 'skip'; force?: boolean; logger?: ILogger }
): Promise<Map<string /* absPath */, Record<string, unknown>>>;
```

```python
def load_files(
    paths: list[str],
    *,
    missing: Literal["raise", "skip"] = "raise",
    force: bool = False,
    logger: logging.Logger | None = None,
) -> "OrderedDict[str, dict]": ...
```

## Inputs

| Name      | Type            | Required | Description                                              |
| --------- | --------------- | -------- | -------------------------------------------------------- |
| `paths`   | `string[]`      | yes      | Ordered list of YAML files. Each entry must be a string. |
| `missing` | `'raise'\|'skip'` | no    | Behaviour when a file does not exist. Default `'raise'`. |
| `force`   | `boolean`       | no       | Bypass cache. Default `false`.                           |
| `logger`  | `ILogger`       | no       | Optional structured logger.                              |

## Outputs

Ordered map keyed by absolute resolved path; values are deep-cloned parsed YAML objects (or `{}` for empty files).

## Errors / Failure modes

| Condition                | Surface                                          |
| ------------------------ | ------------------------------------------------ |
| `paths[i]` not a string  | `TypeError`                                      |
| Missing file + `'raise'` | `LoadError` with `.path` set                     |
| YAML parse failure       | `LoadError` with `.path` and `.cause` set        |
| Invalid `missing` value  | `Error` (mjs) / `ValueError` (py)                |

## Example

```js
const map = await loadFiles(['/abs/a.yml', '/abs/b.yml']);
const a = map.get('/abs/a.yml');
```

## Notes

- Cache is process-local. See `clearCache()` for invalidation.
- Iteration order is insertion order — DO NOT rely on `Map`'s default iteration semantics in unrelated languages.

## Implementation

- mjs: [`packages/mjs/src/loader.mjs`](../../packages/mjs/src/loader.mjs)
- py: [`packages/py/src/app_yaml_loader/loader.py`](../../packages/py/src/app_yaml_loader/loader.py)
