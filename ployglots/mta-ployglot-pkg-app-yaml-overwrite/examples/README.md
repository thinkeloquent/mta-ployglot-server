# Examples

End-to-end runnable samples for the engine + applier. Library-only — no CLI.

| Surface | Folder         | When to use                                                       |
| ------- | -------------- | ----------------------------------------------------------------- |
| SDK     | [`sdk/`](sdk/) | Embedding either package alone or both together.                  |
| API     | [`api/`](api/) | Function-signature contracts.                                     |

## Conventions

- Examples assume `npm install && uv sync` have been run from the repo root.
- `sdk/02-applier-standalone.md` deliberately does **not** import the engine — proves the applier works with any duck-typed resolver.
- The integration scenario (`sdk/03-engine-and-applier-together.md`) reproduces the
  source `app_yaml_overwrites.ConfigSDK.getResolved` behaviour end-to-end.
