# SDK Example: Coercion cascade — env-driven feature flag

## Goal

Demonstrate the typical "feature flag from env var" pattern: `resolveBool` reads `process.env.FEATURE_FLAG`, accepts any case-insensitive truthy variant (`true`/`1`/`yes`/`on`), and returns a `bool`. This composes the four-tier resolver with the coercion wrapper.

## Prerequisites

- Both packages installed.
- `FEATURE_FLAG` is set to `yes` for the run.

## Code

### TypeScript

```ts
import { resolveBool } from '@org/env-resolve';

process.env.FEATURE_FLAG = 'yes';

const enabled = resolveBool(undefined, 'FEATURE_FLAG', null, null, false);
console.log('enabled:', enabled);

if (enabled) {
  console.log('new code path');
} else {
  console.log('old code path');
}
```

### Python

```python
import os
from env_resolve import resolve_bool

os.environ["FEATURE_FLAG"] = "yes"

enabled = resolve_bool(None, "FEATURE_FLAG", None, None, False)
print("enabled:", enabled)

if enabled:
    print("new code path")
else:
    print("old code path")
```

## Expected outcome

Both implementations print:

```
enabled: true
new code path
```

(Python prints `True` instead of `true`; the rest is identical.)

If `FEATURE_FLAG` is unset, both fall to the `false` default; if it is set to `0`, `no`, `off`, or any other non-truthy string, both return `false`.

## Notes

- Truthy strings are case-insensitive: `Yes`, `TRUE`, and `On` all resolve to `true`.
- See [`SPEC.md`](../../SPEC.md#truthy-strings) for the canonical truthy-string set.
- For integer flags (e.g., `WORKER_COUNT`), use `resolveInt` / `resolve_int` — see the API contract docs.
