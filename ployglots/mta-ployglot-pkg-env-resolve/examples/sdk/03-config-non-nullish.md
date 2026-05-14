# SDK Example: Config tier with non-nullish gate (D3)

## Goal

Demonstrate the canonical D3 rule: a config object that explicitly stores `null` / `None` for a key is treated as "this value is intentionally suppressed; use the default" — the resolver does **not** return the explicit nullish value.

## Prerequisites

- Both packages installed.
- No env-var setup required.

## Code

### TypeScript

```ts
import { resolve } from '@org/env-resolve';

const suppressed = { db_url: null };
const populated = { db_url: 'postgres://primary' };

console.log('suppressed:', resolve(null, null, suppressed, 'db_url', 'sqlite://memory'));
console.log('populated :', resolve(null, null, populated, 'db_url', 'sqlite://memory'));
```

### Python

```python
from env_resolve import resolve

suppressed = {"db_url": None}
populated = {"db_url": "postgres://primary"}

print("suppressed:", resolve(None, None, suppressed, "db_url", "sqlite://memory"))
print("populated :", resolve(None, None, populated, "db_url", "sqlite://memory"))
```

## Expected outcome

Both implementations print:

```
suppressed: sqlite://memory
populated : postgres://primary
```

The `null`/`None` value falls through to tier 4 (default). The real value is returned as-is.

## Notes

- This rule (D3) was a real divergence in the original packages: Python's `key in config` returned the explicit `None`, while TS's `config[key] !== undefined` skipped only `undefined`. The aligned spec uses **value-non-nullish** semantics, normalizing both sides.
- Use this pattern when a layered config (CLI > user-config > defaults) needs an intermediate layer to "opt out" without erasing the entry.
- See [`SPEC.md`](../../SPEC.md#config-key-value-non-nullish-rule-d3) for the formal rule.
