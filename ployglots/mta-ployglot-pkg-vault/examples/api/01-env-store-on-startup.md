# API — `EnvStore.onStartup`

## Goal

Initialize the process-wide env store from a `.env`-format file. This is the
single entry point used by both SDK flavours and by consumer addons.

## Signature / Contract

```ts
// TS
static onStartup(envFile: string, logger?: IVaultFileLogger): LoadResult
```

```python
# Py
@classmethod
def on_startup(cls, env_file: str = ".env", logger: Optional[IVaultFileLogger] = None) -> LoadResult
```

## Inputs

| Name      | Type                         | Required | Default | Description                                       |
| --------- | ---------------------------- | -------- | ------- | ------------------------------------------------- |
| `envFile` | string                       | yes (TS) | `.env` (py) | Filesystem path to a dotenv-format file.   |
| `logger`  | `IVaultFileLogger` optional  | no       | module logger | Override for the warn/error log sink.       |

## Outputs

`LoadResult { totalVarsLoaded: number }` — count of entries now accessible
through `EnvStore.get`. Wire-format field name is **`totalVarsLoaded`** on
both twins (camelCase alias on the py model).

## Errors / Failure modes

- Empty path → `Error("Environment file path is required")` (TS) /
  `ValueError("Environment file path is required")` (py).
- Parse error on a valid path → re-thrown / re-raised to the caller.
- Missing file → logged warning via the injected logger; store stays empty;
  no throw. `isInitialized()` still returns `true` afterwards.

## Example

```ts
import { EnvStore } from '@polyglot/vault-file';
const r = EnvStore.onStartup('.env');
console.log(r.totalVarsLoaded);
```

```python
from polyglot_vault_file import EnvStore
r = EnvStore.on_startup(".env")
print(r.total_vars_loaded)
```

## Notes

- **Synchronous on both twins.** TS callers wanting a Promise can use
  `EnvStore.onStartupAsync(...)`.
- Call exactly once during boot — the singleton is cached; subsequent calls
  layer additional keys on top of the existing store but will not clear it.
