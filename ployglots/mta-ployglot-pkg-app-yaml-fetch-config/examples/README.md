# Examples

End-to-end runnable samples for `app-yaml-fetch-config`. Library-only.

| Surface | Folder         | When to use                                                |
| ------- | -------------- | ---------------------------------------------------------- |
| SDK     | [`sdk/`](sdk/) | Embedding the fetch-config extractor.                      |
| API     | [`api/`](api/) | Function-signature contracts.                              |

Fixtures used by SDK scenarios live in [`fixtures/`](fixtures/).

## Conventions

- Examples assume both packages are installed (`make install` in each).
- Tests / examples reset module-level `_config` between cases (call `loadConfig({})`).
- Returned `FetchConfig.headersTimeout` matches Node `fetch` naming; remap to `timeout` if your client expects that.
