# Twin Parity — `vault-file` (ts) ↔ `vault-file` (py)

Single twin pair in this repo. Aligned as of 1.0.0; the two sides are
behaviourally interchangeable on wire format and error shape.

## Aligned invariants

| Drift area                          | Decision                                                     |
| ----------------------------------- | ------------------------------------------------------------ |
| `EnvStore.get` priority             | **store → env → default** (py-canonical — "vault wins")      |
| `onStartup` sync/async              | **Sync on both sides**; TS also exports `onStartupAsync` adapter |
| `LoadResult` JSON wire format       | camelCase (`totalVarsLoaded`) on both; py attrs stay snake_case |
| `fromJSON` return type              | Validated `VaultFile` on both sides (was `any` on pre-1.0 mjs) |
| `EnvKeyNotFoundError.key` attr      | Present on both sides                                        |
| `EnvKeyNotFoundError` message       | `"Environment variable '{key}' not found"` on both           |
| `SDKError` shape                    | Named class/model on both (py: pydantic model; ts: interface + `makeSDKError`) |
| `VaultFileSDK.setLogger` / builder `withLogger` | Present on both sides                             |
| `createdAt` default precision       | Milliseconds on both                                         |
| `diagnoseEnvStore.varsLoaded`       | Real count from `_getTotalVarsLoaded()` (bug fix — was 0 on both surveyed) |
| Unused runtime deps                 | Pruned from both manifests (`dotenv`, `js-yaml`, `uuid`, `glob`, `python-dotenv`, `pyyaml`) |
| `VaultFileSDK` private constructor  | Internal factory (`newForBuilder()`) on TS — no `@ts-ignore` |

## Intentional residual drift

These differences exist by language idiom, not by bug:

| Surface                              | TS                           | Py                                                     |
| ------------------------------------ | ---------------------------- | ------------------------------------------------------ |
| Empty-key error type                 | `Error('Key is required')`   | `ValueError('Key is required')` — same message, different class by idiom |
| Empty-env-path error type            | `Error(...)`                 | `ValueError(...)` — same pattern                       |
| `LoadResult` attribute               | `.totalVarsLoaded`           | `.total_vars_loaded` (alias `"totalVarsLoaded"` at the wire) |
| Timestamp suffix                     | `...Z`                       | `...+00:00` — both are ISO 8601 compliant              |

## How parity is enforced

- **Byte-identical fixtures** under `packages/{ts,py}/tests/fixtures/` —
  `make parity` at the workspace root `diff -r`s the two trees before
  running either test suite.
- **Parity test file** on each side (`packages/ts/tests/parity.test.ts`,
  `packages/py/tests/test_parity.py`) encodes the 12 aligned invariants as
  12 passing test cases with matching numbering.
- **CHANGELOG.md** at the repo root documents the 1.0.0 breaking changes
  (vault-wins, sync onStartup) so downstream consumers see the delta.
