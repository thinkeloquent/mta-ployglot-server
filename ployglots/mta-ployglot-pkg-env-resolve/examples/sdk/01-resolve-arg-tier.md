# SDK Example: Arg-tier short-circuit

## Goal

Demonstrate that an explicit argument always wins over env vars and config. This is tier 1 of the four-tier algorithm — the most common pattern when a CLI flag must override everything else.

## Prerequisites

- Both packages installed locally (see `examples/sdk/README.md` setup).
- No env-var setup required.

## Code

### TypeScript

```ts
import { resolve } from '@org/env-resolve';

process.env.IGNORED_ENV = 'from-env';
const config = { x: 'from-config' };

const value = resolve('explicit', 'IGNORED_ENV', config, 'x', 'DEFAULT');
console.log(value);
```

### Python

```python
import os
from env_resolve import resolve

os.environ["IGNORED_ENV"] = "from-env"
config = {"x": "from-config"}

value = resolve("explicit", "IGNORED_ENV", config, "x", "DEFAULT")
print(value)
```

## Expected outcome

Both implementations print:

```
explicit
```

The `arg` short-circuits at tier 1; `process.env.IGNORED_ENV` and `config["x"]` are never consulted.

## Notes

- This is the most common reason a CLI flag overrides everything else — a caller passes the parsed flag as `arg` and the function "stops looking" if it's set.
- If `arg` is `null` or `undefined` (Python: `None`), the function falls through to tier 2. See `03-config-non-nullish.md` and `02-env-first-match.md` for the next-tier paths.
