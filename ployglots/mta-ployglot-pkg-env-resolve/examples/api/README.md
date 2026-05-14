# API Examples

The package's public surface contract — function signatures, parameter semantics, return types, and the exhaustive list of failure modes.

## Surface kind

Synchronous function calls on a module export. Both TypeScript (`@org/env-resolve`) and Python (`env_resolve`) expose the same four functions; the only differences are language-convention spellings (`resolveBool` ↔ `resolve_bool`, `defaultValue` ↔ `default`). Cross-language behavior is governed by [`SPEC.md`](../../SPEC.md) and enforced by `tests/parity/fixtures.json`.

## Entries

| #   | Entry                               | Description                                       |
| --- | ----------------------------------- | ------------------------------------------------- |
| 01  | [`resolve`](01-resolve.md)          | Generic four-tier resolver.                       |
| 02  | [`resolveBool`](02-resolve-bool.md) | Coerce to `boolean` with truthy-string set.       |
| 03  | [`resolveInt`](03-resolve-int.md)   | Coerce to `int`; rejects decimals + bools (D4/D5). |
| 04  | [`resolveFloat`](04-resolve-float.md) | Coerce to `float`; rejects partial-numeric (D6). |
