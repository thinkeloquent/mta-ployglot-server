# SDK Examples

Programmatic usage of `@polyglot/vault-file` and `polyglot-vault-file`.

## Setup

```bash
# TS side
(cd packages/ts && npm install && npm run build)

# Py side
(cd packages/py && uv sync)
```

## Scenarios

| #   | Scenario                                                | Description                                       |
| --- | ------------------------------------------------------- | ------------------------------------------------- |
| 01  | [Load from env](01-load-from-env.md)                    | Build SDK via builder, loadConfig, print result.  |
| 02  | [Load from path](02-load-from-path.md)                  | Explicit path override.                           |
| 03  | [Validate file](03-validate-file.md)                    | Validate a fixture; print errors/warnings.        |
| 04  | [Describe config](04-describe-config.md)                | Print ConfigDescription (exercises bug fix).      |
| 05  | [Get secret safe](05-get-secret-safe.md)                | Masked lookup + missing-key path.                 |

## Running

TS runnables live at `packages/ts/examples/sdk/NN-*.mjs`; run with
`node packages/ts/examples/sdk/01-load-from-env.mjs`.

Python runnables live at `packages/py/examples/sdk/NN_*.py`; run with
`uv run python packages/py/examples/sdk/01_load_from_env.py`.
