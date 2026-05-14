# mta-ployglot-pkg-vault-file

Workspace root for `@polyglot/vault-file` (TypeScript) + `polyglot-vault-file`
(Python) — a vault file + env-store SDK. The two packages are twin ports of
the surveyed `vault_file` source, aligned on wire format and error shape so
they are behaviourally interchangeable.

## Packages

| Package               | Language   | Path              |
| --------------------- | ---------- | ----------------- |
| `@polyglot/vault-file` | TypeScript | `packages/ts/`    |
| `polyglot-vault-file`  | Python     | `packages/py/`    |

## Canonical behaviour decisions

| Drift                              | Decision                                                     |
| ---------------------------------- | ------------------------------------------------------------ |
| `EnvStore.get` priority            | **store → env → default** (py-canonical — "vault wins")      |
| `onStartup` sync/async             | **Sync on both sides**; TS also exports `onStartupAsync` adapter |
| `LoadResult` JSON wire format      | camelCase (`totalVarsLoaded`) on both; attrs stay snake_case in py |
| `fromJSON` return type             | Validated `VaultFile` on both sides (was `any` on mjs)       |
| `EnvKeyNotFoundError.key` attr     | Present on both sides                                        |
| `EnvKeyNotFoundError` message      | `"Environment variable '{key}' not found"` on both           |
| `SDKError` shape                   | Named class/model on both (py already has it; mjs adds it)   |
| `VaultFileSDK.setLogger` / `withLogger` | Present on both sides                                 |
| `createdAt` default precision      | Milliseconds on both                                         |
| `diagnoseEnvStore.varsLoaded`      | Real count from `_totalVarsLoaded` (bug fix — was 0 in both) |
| Unused runtime deps                | Pruned from both manifests                                   |
| `VaultFileSDK` private constructor | Internal factory (`newForBuilder()`) — no `@ts-ignore`       |

## Quickstart

```bash
make ci                         # fan out: install + lint + test + build on both
make -C packages/ts ci          # ts only
make -C packages/py ci          # py only
make cov                        # coverage on both sides
make parity                     # byte-identical fixtures + both parity suites
```

## Migration from surveyed source

The ported package differs from the surveyed mjs source in five observable
ways:

1. **Vault-wins `get` priority.** `EnvStore.get(key)` now returns the value
   loaded from the env file even when `process.env[key]` is set — the py
   behaviour is canonical on both sides.
2. **Sync `onStartup`.** `EnvStore.onStartup(path)` is synchronous on both
   twins. TS callers that want an awaitable shape call
   `EnvStore.onStartupAsync(path)` which returns `Promise<LoadResult>`.
3. **`EnvKeyNotFoundError.key` attribute.** The TS error now carries the key
   on the instance (`err.key`) in addition to the message text.
4. **Named `SDKError`.** `SDKError` is an exported named class on TS (was an
   anonymous inline shape); on py it remains the `SDKError(BaseModel)` type.
5. **Bilateral `withLogger` / `setLogger`.** The TS builder and SDK now
   expose logger injection that matches the py signatures.

See `CHANGELOG.md` for the full 1.0.0 delta.
