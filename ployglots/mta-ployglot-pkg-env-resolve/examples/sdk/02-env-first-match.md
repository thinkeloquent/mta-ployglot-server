# SDK Example: Env-list first-match-wins

## Goal

Demonstrate tier 2 of the algorithm: when `arg` is unset, scan a list of candidate env-var names and return the first non-empty match. Useful when migrating between env-var names without breaking older configurations.

## Prerequisites

- Both packages installed.
- `DATABASE_URL` is set; the legacy `POSTGRES_URL` is not.

## Code

### TypeScript

```ts
import { resolve } from '@org/env-resolve';

process.env.DATABASE_URL = 'postgres://primary/db';
delete process.env.POSTGRES_URL;
delete process.env.DB_URL;

const value = resolve(null, ['DB_URL', 'DATABASE_URL', 'POSTGRES_URL'], null, null, 'sqlite://memory');
console.log(value);
```

### Python

```python
import os
from env_resolve import resolve

os.environ["DATABASE_URL"] = "postgres://primary/db"
os.environ.pop("POSTGRES_URL", None)
os.environ.pop("DB_URL", None)

value = resolve(None, ["DB_URL", "DATABASE_URL", "POSTGRES_URL"], None, None, "sqlite://memory")
print(value)
```

## Expected outcome

Both implementations print:

```
postgres://primary/db
```

`DB_URL` is unset, so the scan moves to `DATABASE_URL`, which is set — first-match wins. `POSTGRES_URL` is never inspected.

## Notes

- The list-of-keys form is the migration-friendly idiom: ship a new env-var name and keep the old one in the list as a fallback. Once usage migrates, drop the old name.
- A bare string (`resolve(null, "DATABASE_URL", ...)`) works too; it's equivalent to a one-element list.
- Empty-string keys in the list are skipped silently.
