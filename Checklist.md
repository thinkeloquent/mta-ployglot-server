# Development Checklist — mta-ployglot-server

Pre-PR workflow tailored to this polyglot meta-repo (Fastify mjs + FastAPI py twins, sibling repos cloned next to this one, vault-wins env store, bootstrap-addon priority system, per-package CI Makefiles).

---

## 1. Preparation & Branching

- [ ] **Sync with main** — pull the latest `main` so you start from current code.
- [ ] **Create a descriptive branch** — e.g. `feature/add-auth-middleware`, `bugfix/api-timeout-error`.
- [ ] **Identify polyglot scope** — note up front whether the change touches `server/fastify`, `server/fastapi`, both twins, or shared parity contracts under `server/parity/`.

## 2. Environment Setup

- [ ] **Start infrastructure** — bring up local databases / caches / workers (Docker Compose if used).
- [ ] **Workspace bootstrap, not just `npm install`** — sibling repos cloned alongside this one are wired via `file:` deps + symlinks. After a `main` pull, run the workspace bootstrap (root Makefile / `local-workspace-bootstrap` skill) to regenerate manifests; otherwise twin packages may resolve to stale code.
- [ ] **Sync per-language deps** — `npm install` for `server/fastify`, `uv sync` / `pip install` for `server/fastapi`.
- [ ] **Verify vault / env store** — confirm any required secrets are reachable via the vault (priority is **vault → `process.env` → default**, opposite of dotenv); `EnvStore.get` does not mutate `process.env`.

## 3. Implementation & Observability

- [ ] **Write the code** — feature, bugfix, or config change.
- [ ] **Maintain twin parity** — every change to `server/fastify` (mjs) likely needs a matching change to `server/fastapi` (py), and vice versa. Update `server/parity/` contracts if the public surface shifts.
- [ ] **Respect bootstrap-addon prefix discipline** — new files under `server/{fastify,fastapi}/config/` must follow `environment=10 / lifecycle=20 / route=30`. Wrong prefix = silent ordering bug.
- [ ] **DI surface vs demo routes** — keep DI surface generic; per-provider routes (`30_github.routes.*`, `30_jira.routes.*`, etc.) are demo examples of the DI, not a production catalog.
- [ ] **Defensive programming** — comprehensive logging for hyper-observability, validation hooks at system boundaries, graceful error handling.
- [ ] **Vault-aware secret access** — read secrets through `vault.get()` (greppable accessor); do not assume `process.env` is authoritative.

## 4. Local Testing & Quality Gates

- [ ] **Use per-package CI Makefiles** — invoke `Makefile.ci` / `Makefile.servers-ci` so local runs match CI (rather than ad-hoc `npm test` / `pytest`).
- [ ] **Logic coverage** — unit + integration tests for the new logic, both twins where applicable.
- [ ] **Twin-parity check** — run the parity audit (`sdk-polyglot-parity-auditor` agent) if the change touches public surface, models, middleware, or errors.
- [ ] **Linting & formatting** — language-native formatters/linters via the per-package Makefiles.
- [ ] **Security scans** — dependency audits (`npm audit`, `pip-audit` / `uv` equivalents) and secret scanners. Remember vault keys are *not* `.env` leaks.
- [ ] **Doctor / health check** — run the orchestration-shell `doctor` (`make doctor` style) to catch "fresh clone doesn't work" regressions unit tests miss.

## 5. Commit & Push

- [ ] **Self-review the diff** — drop debug logs, stray prints, TODOs, typos.
- [ ] **Refresh `.agent.md`** — if public surface changed, update the per-package agent skill docs (LLM entry points). Reminder: never cite `AI-Agent-Plans/*` inside `.agent.md` — plans are transient.
- [ ] **Write a changelog entry** — use the `ployglot-changelog` skill; entries land in the `./.changelogs/` submodule, one per commit.
- [ ] **Atomic commits with clear messages** — what changed and why.
- [ ] **Push & open PR** — push the branch and open a PR/MR for review.

---

## Quick reference — repo-specific landmines

| Landmine | Detection |
| --- | --- |
| Twin drift (mjs ↔ py) | `sdk-polyglot-parity-auditor` agent |
| Wrong addon prefix | File ordering bug; check `10/20/30` convention |
| Stale workspace symlinks after `main` pull | Re-run workspace bootstrap |
| Treating `process.env` as authoritative | Use `vault.get()` instead — vault wins |
| Local tests pass, CI fails | You skipped `Makefile.ci` / `Makefile.servers-ci` |
| `.agent.md` references a plan doc | Forbidden — plans are transient |
