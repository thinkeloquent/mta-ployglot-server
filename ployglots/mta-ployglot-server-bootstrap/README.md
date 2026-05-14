# mta-server-root

Monorepo housing two publishable polyglot bootstrap packages — one per runtime.

## Packages

| Directory         | Registry                 | Purpose                                                              |
| ----------------- | ------------------------ | -------------------------------------------------------------------- |
| `fastify_server/` | npm (`fastify-server`)   | Runtime-neutral bootstrap orchestrator + Fastify 5 adapter + addons.  |
| `fastapi_server/` | PyPI (`thinkeloquent-fastapi-server`) | Runtime-neutral bootstrap orchestrator + FastAPI adapter + addons.    |

Both ship byte-identical JSON Schema contracts under each package's `contracts/` folder. See each package's README for install, quickstart, and API surface.

## Layout

```
.
├── fastify_server/       # npm package (fastify-server)
│   ├── src/              # TS library source
│   ├── contracts/        # JSON Schemas (shipped)
│   ├── examples/         # runnable demos (not shipped)
│   ├── test/
│   ├── package.json
│   └── README.md
├── fastapi_server/       # PyPI package (thinkeloquent-fastapi-server)
│   ├── fastapi_server/
│   │   ├── bootstrap/    # library source
│   │   └── cli.py        # default CLI entry (`fastapi-server`)
│   ├── contracts/
│   ├── examples/
│   ├── tests/
│   ├── pyproject.toml
│   └── README.md
├── scripts/
│   ├── smoke.sh          # boot both packages end-to-end
│   └── sync-contracts.sh # keep contracts/ in sync across packages
└── README.md
```

## Development

Each package is self-contained.

```bash
# Fastify
cd fastify_server && npm install && npm run build && npm test && npm start

# FastAPI
uv venv .venv --python 3.13
uv pip install --python .venv/bin/python -e "./fastapi_server[dev]"
.venv/bin/pytest fastapi_server/tests
.venv/bin/python fastapi_server/examples/quickstart/main.py
```

Run both smoke tests: `bash scripts/smoke.sh`.

When editing a `*.schema.json` under `contracts/`, update both packages and run `scripts/sync-contracts.sh diff` to verify byte-identity — see each package's "Updating JSON Schema contracts" section.

## License

MIT. Each package ships its own LICENSE file.
