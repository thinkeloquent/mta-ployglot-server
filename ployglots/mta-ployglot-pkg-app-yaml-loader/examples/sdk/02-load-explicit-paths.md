# SDK Example: Load explicit paths with skip-missing

## Goal

Bypass the canonical file-list helpers and supply an explicit list. Use `missing: 'skip'` to tolerate optional files.

## Prerequisites

- `examples/fixtures/explicit/a.yml` exists.
- `examples/fixtures/explicit/b.yml` does NOT exist (intentionally absent).
- `examples/fixtures/explicit/c.yml` exists.

## Code (mjs)

```js
import { loadFiles } from '@ployglot/app-yaml-loader';

const map = await loadFiles(
  ['./examples/fixtures/explicit/a.yml',
   './examples/fixtures/explicit/b.yml',
   './examples/fixtures/explicit/c.yml'],
  { missing: 'skip', logger: console }
);

console.log('keys:', Array.from(map.keys()).map(p => p.split('/').pop()));
```

## Code (py)

```python
import logging
from app_yaml_loader import load_files

logging.basicConfig(level=logging.WARNING)

m = load_files(
    [
        "./examples/fixtures/explicit/a.yml",
        "./examples/fixtures/explicit/b.yml",
        "./examples/fixtures/explicit/c.yml",
    ],
    missing="skip",
)
print("keys:", [p.rsplit("/", 1)[-1] for p in m.keys()])
```

## Expected outcome

```
keys: [ 'a.yml', 'c.yml' ]
```

Plus a `logger.warn` line referencing `b.yml`.

## Notes

- `missing: 'skip'` returns no entry — the map size differs from the input array length.
- `missing: 'raise'` (the default) would throw a `LoadError` on `b.yml`.
