---
name: contract-parity
scope: fastapi_server
description: Safely change a JSON Schema under contracts/ and mirror it to fastify_server so parity tests stay green.
triggers:
  - "update schema"
  - "contract parity"
  - "sync contracts"
  - "bootstrap.schema.json"
  - "loader.schema.json"
  - "hooks.schema.json"
---

# Skill — Contract parity (Python side)

## Rule 0

`fastapi_server/contracts/*.json` and `fastify_server/contracts/*.json` are **byte-for-byte identical**. Every edit is a two-file edit in the same PR.

Enforced by: `fastapi_server/tests/test_contract_parity.py` — it hashes both sides and fails the build on drift.

## Workflow

1. **Decide which schema you're changing.**
   - `bootstrap.schema.json` → shape of user-supplied config.
   - `hooks.schema.json` → lifecycle hook signatures.
   - `loader.schema.json` → `LoaderReport` structure.
2. **Edit the file in whichever package is open.**
3. **Mirror to the peer.** Either:
   - Run `scripts/sync-contracts.sh to-fastapi` or `scripts/sync-contracts.sh to-fastify` from the repo root (if present), OR
   - Copy the file by hand: `cp fastapi_server/contracts/X.json fastify_server/contracts/X.json` (or vice versa).
4. **Update the code that reads/writes the schema** on **both** sides:
   - Python: `fastapi_server/bootstrap/contract/types.py`, `validators.py`.
   - TypeScript: `fastify_server/src/contract/types.ts`, `validators.ts`.
5. **Update both `.Agent.md` files** if the change affects documented fields.
6. **Run parity + unit tests:**
   ```bash
   (cd fastapi_server && pytest tests/test_contract_parity.py tests/test_contract.py)
   (cd fastify_server && npm test)
   ```
7. **Commit both packages in the same PR.** Single-sided commits will fail CI.

## Back-compat checklist

For any schema change, ask:

- [ ] **Added a field?** → optional (no change needed to existing user configs).
- [ ] **Renamed a field?** → breaking. Bump major in both `pyproject.toml` and `package.json`. Provide a migration note.
- [ ] **Tightened validation?** (e.g. narrower enum) — breaking if any existing user can trip the new constraint.
- [ ] **Loosened validation?** → non-breaking, but document in both READMEs.
- [ ] **Changed `required`?** → almost always breaking.

## Files to touch for a typical "add a field to BootstrapConfig" change

| Python side | TypeScript side |
| --- | --- |
| `contracts/bootstrap.schema.json` | `contracts/bootstrap.schema.json` (identical) |
| `fastapi_server/bootstrap/contract/types.py` (`BootstrapConfig`, `from_dict`) | `src/contract/types.ts` (`BootstrapConfig`) |
| `fastapi_server/bootstrap/contract/validators.py` (if validated) | `src/contract/validators.ts` (if validated) |
| `fastapi_server/bootstrap/contract/validators.py::merge_config` (if merged) | `src/contract/validators.ts::mergeConfig` (if merged) |
| `tests/test_contract.py` | `test/contract.test.ts` |
| `README.md`, `.Agent.md` | `README.md`, `.Agent.md` |

## Anti-patterns

- Editing one side's JSON "for now" and promising to mirror later — parity test will block merge and the two copies drift in review.
- Adding a field to the Python dataclass but not to the TS interface (or vice versa).
- Bumping `$id` — don't. The `$id` is stable and identifies the contract across runtimes.
- Introducing `additionalProperties: false` on `BootstrapConfig` — the schema is deliberately open (see `"additionalProperties": true`). Unknown keys land in `extra`.
