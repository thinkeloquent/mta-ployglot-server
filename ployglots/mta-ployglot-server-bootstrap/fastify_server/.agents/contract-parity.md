---
name: contract-parity
scope: fastify_server
description: Safely change a JSON Schema under contracts/ and mirror it to fastapi_server so parity tests stay green.
triggers:
  - "update schema"
  - "contract parity"
  - "sync contracts"
  - "bootstrap.schema.json"
  - "loader.schema.json"
  - "hooks.schema.json"
---

# Skill — Contract parity (TypeScript side)

## Rule 0

`fastify_server/contracts/*.json` and `fastapi_server/contracts/*.json` are **byte-for-byte identical**. Every edit is a two-file edit in the same PR.

Enforced by: `../fastapi_server/tests/test_contract_parity.py` — it hashes both sides and fails the build on drift.

## Workflow

1. **Decide which schema you're changing.**
   - `bootstrap.schema.json` → shape of user-supplied config.
   - `hooks.schema.json` → lifecycle hook signatures.
   - `loader.schema.json` → `LoaderReport` structure.
2. **Edit the file in whichever package is open.**
3. **Mirror to the peer.** Either:
   - Run `scripts/sync-contracts.sh to-fastify` or `to-fastapi` from the repo root (if present), OR
   - Copy by hand: `cp fastify_server/contracts/X.json fastapi_server/contracts/X.json` (or vice versa).
4. **Update the code that reads/writes the schema** on **both** sides:
   - TypeScript: `src/contract/types.ts`, `src/contract/validators.ts`.
   - Python: `fastapi_server/bootstrap/contract/types.py`, `validators.py`.
5. **Update both `.Agent.md` files** if the change affects documented fields.
6. **Run parity + unit tests:**
   ```bash
   (cd fastify_server && npm test)
   (cd fastapi_server && pytest tests/test_contract_parity.py tests/test_contract.py)
   ```
7. **Commit both packages in the same PR.** Single-sided commits will fail CI.

## Back-compat checklist

- [ ] **Added a field?** → optional in the schema (no change needed to existing user configs).
- [ ] **Renamed a field?** → breaking. Bump major in both `package.json` and `pyproject.toml`.
- [ ] **Tightened validation?** (e.g. narrower enum) — breaking if any existing user can trip the new constraint.
- [ ] **Loosened validation?** → non-breaking, but document in both READMEs.
- [ ] **Changed `required`?** → almost always breaking.

## Keep the JSON keys in `snake_case`

The schemas use `snake_case` for `json_format`, `initial_state`, etc. The TypeScript interface mirrors those names verbatim — do **not** refactor to camelCase in `BootstrapConfig`. Camel-casing happens only on function names (`mergeConfig`, `resolvePaths`), not on data keys.

## Files to touch for a typical "add a field to BootstrapConfig" change

| TypeScript side | Python side |
| --- | --- |
| `contracts/bootstrap.schema.json` | `contracts/bootstrap.schema.json` (identical) |
| `src/contract/types.ts` (`BootstrapConfig`, `ResolvedBootstrapConfig`) | `fastapi_server/bootstrap/contract/types.py` |
| `src/contract/validators.ts` (if validated / merged) | `fastapi_server/bootstrap/contract/validators.py` |
| `test/contract.test.ts` | `tests/test_contract.py` |
| `README.md`, `.Agent.md` | `README.md`, `.Agent.md` |

## Anti-patterns

- Editing one side's JSON "for now" — parity test will block merge.
- Adding a field to the TS interface but forgetting the Python dataclass (or vice versa).
- Bumping `$id` — don't. The `$id` is stable and identifies the contract across runtimes.
- Introducing `additionalProperties: false` on `BootstrapConfig` — the schema is deliberately open. Unknown keys flow through to `config.extra` on the Python side and to the index-signature `[k: string]: unknown` on the TS side.
