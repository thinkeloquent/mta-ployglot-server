# mta-ployglot-pkg-app-yaml-loader

Polyglot library that reads an ordered list of YAML files from disk and returns them as a path-keyed map of parsed objects. No merge, no template resolution, no schema validation — siblings (`app_yaml_config`, `app_yaml_overwrite`) own those.

## Packages

| Package | Language | Path |
| ------- | -------- | ---- |
| `@ployglot/app-yaml-loader` | Node ESM (`.mjs`) | [`packages/mjs/`](packages/mjs/) |
| `app_yaml_loader`           | Python 3.11+      | [`packages/py/`](packages/py/) |

## Quickstart

```bash
# Node
cd packages/mjs && make ci

# Python
cd packages/py  && make ci
```

## Plan

The implementation is driven by the plan tree at `../AI-Agent-Plans/18/app-yaml-loader-20260427-7b3e4f1a/`. Read its `README.md` for goal/scope and walk `features/` → `stories/` → `tasks/` for the 3-tier breakdown. See [`.Agent.md`](.Agent.md) for downstream-agent integration.

## Examples

| Surface | Folder | When to use |
| ------- | ------ | ----------- |
| SDK     | [`examples/sdk/`](examples/sdk/) | Embed the loader in another library or service. |
| API     | [`examples/api/`](examples/api/) | Public function-signature reference. |
