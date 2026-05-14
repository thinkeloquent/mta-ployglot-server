# SDK Examples

Programmatic embedding of `env-resolve` inside another codebase. Each scenario shows TypeScript and Python side-by-side so the parity is visible at a glance.

## Setup

### TypeScript

```bash
npm install @org/env-resolve
```

```ts
import { resolve, resolveBool, resolveInt, resolveFloat } from '@org/env-resolve';
```

### Python

```bash
pip install env-resolve
```

```python
from env_resolve import resolve, resolve_bool, resolve_int, resolve_float
```

There is no construction step — every function is pure and stateless. Import and call.

## Scenarios

| #   | Scenario                                                            | Description                                       |
| --- | ------------------------------------------------------------------- | ------------------------------------------------- |
| 01  | [Arg-tier short-circuit](01-resolve-arg-tier.md)                    | Direct argument always wins (tier 1).             |
| 02  | [Env-list first-match-wins](02-env-first-match.md)                  | Multiple env keys, first present wins (tier 2).   |
| 03  | [Config tier with non-nullish gate](03-config-non-nullish.md)       | `{key: null}` falls through to default (D3).      |
| 04  | [Coercion cascade — env-driven feature flag](04-coercion-cascade.md) | `resolveBool` reading `FEATURE_FLAG=yes`.         |
