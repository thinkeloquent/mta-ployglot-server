# Examples

End-to-end runnable samples for `app-yaml-loader`. CLI surface is intentionally absent (library-only). Each subfolder is independent.

| Surface | Folder         | When to use                                                |
| ------- | -------------- | ---------------------------------------------------------- |
| SDK     | [`sdk/`](sdk/) | Embedding the loader inside another library or service.    |
| API     | [`api/`](api/) | Function-signature reference for `loadFiles`, `buildConfigFiles`, etc. |

## Conventions

- Every example is self-contained: prerequisites, setup, run, expected output.
- Examples assume both packages are built (`make build` in each).
- No secrets; YAML fixtures are committed under `examples/fixtures/`.
