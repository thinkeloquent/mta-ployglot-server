# SDK Examples

Programmatic embedding of `app-yaml-loader`.

## Setup

```bash
# mjs
cd packages/mjs && npm install && make build
# py
cd packages/py && pip install -e . && make build
```

```js
import { loadFromConfigDir, clearCache } from '@ployglot/app-yaml-loader';
const map = await loadFromConfigDir({ configDir: './examples/fixtures/canonical', appEnv: 'test' });
```

## Scenarios

| #   | Scenario                                                            | Description                              |
| --- | ------------------------------------------------------------------- | ---------------------------------------- |
| 01  | [Load canonical 6-file set](01-load-canonical-set.md)               | Default behaviour from a config dir.     |
| 02  | [Load explicit paths with skip-missing](02-load-explicit-paths.md)  | Hand-rolled list + missing-skip option.  |
