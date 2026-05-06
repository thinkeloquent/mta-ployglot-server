# mta-ployglot-server v1

Orchestration shell for a polyglot meta-repo. It hydrates a registry of sibling
repos into a local symlink topology, generates per-language workspace manifests
(`pnpm-workspace.yaml`, `go.work`, virtual `Cargo.toml`), and assembles a
release branch via `git subtree` — one squashed commit per sibling.

This repo is **not** a deploy target. It produces a unified release branch by
copy-and-merge (`git subtree`); shipping that branch anywhere is out of scope.

The single source of truth is [`workspace.toml`](./workspace.toml); everything
else (lock JSON, compose, per-language manifests, Make variables) is a
_derived projection_ gated by `make projections-check`. See [SSOT.md](./SSOT.md).

## Quickstart — set up a fresh local dev env

For a brand-new clone on a new machine. Runs end-to-end in ~5 min if your
prereqs are already installed.

**1. Install prerequisites.**

| Tool               | Why                                             | Version |
| ------------------ | ----------------------------------------------- | ------- |
| `git`              | clone + sibling fetch                           | any     |
| `python3`          | `tomllib` (used by every emitter and validator) | ≥ 3.11  |
| `node` + `npm`     | fastify runtime + dev-mode iteration            | ≥ 20    |
| `uv`               | fastapi runtime (replaces venv + pip)           | latest  |
| `docker`           | docker-compose mode                             | ≥ 24    |
| `check-jsonschema` | `validate.sh` (`pip install check-jsonschema`)  | latest  |

**2. Lay out the sibling root.** This shell expects every sibling repo to live
next to itself under a shared parent (default: `/<root>/`). Pick
a parent dir; clone _this_ repo into it, and `make bootstrap` will clone the
rest.

```bash
mkdir -p /<root> && cd /<root>
git clone https://github.com/thinkeloquent/mta-ployglot-server.git
cd mta-ployglot-server
```

If your siblings live elsewhere, set
`WORKSPACE_OVERRIDE_<NAME_UPPER>=/abs/path` per entry (vault-wins).

**3. Seed the env file.**

```bash
cp .env.example .env       # default ports: fastify 5100, fastapi 5200
```

**4. Hydrate the workspace.** This clones every missing sibling, lays the
`ployglots/<name> → ../<name>` symlinks, and regenerates every derived
projection (`.dev/workspace.toml.lock.json`, `docker-compose.yml`,
`Makefile.entries`, `pnpm-workspace.yaml`, `go.work`, `Cargo.toml`).

```bash
make bootstrap
```

Dry-run first if you want to see what will happen:

```bash
make bootstrap ARGS=--dry-run
```

**5. Verify the topology is healthy.**

```bash
make doctor                # cross-platform health checks
make projections-check     # confirm no committed projection is stale
```

Both should exit 0. `doctor` returns a TSV of `check ok|warn|fail | hint`; if
anything is `fail`, the hint tells you the fixer (often `make doctor-fix`).

**6. Pick a run mode and bring the stack up.**

```bash
make docker                # build images + up + wait healthy (slower; full isolation)
# OR
make dev                   # host processes; faster iteration; needs node + uv on PATH
```

**7. Confirm both runtimes respond.**

```bash
make healthz               # curls /healthz on both fastify + fastapi
```

You should see two pretty-printed JSON blobs, one per service. That's the
green-light: the workspace is hydrated, both runtimes are reachable on their
host ports, and you can start editing.

## Layout

```
.
├── workspace.toml                  # SSOT: every sibling repo + topology
├── SSOT.md                         # what "single source of truth" means here
├── .dev/                           # gitignored; holds workspace.toml.lock.json + dev-mode staging
├── scripts/workspace/              # bootstrap, validate, emit-*, doctor, subtree-*
│   ├── bootstrap.sh                # entry point — clone siblings + symlinks + projections
│   ├── validate.sh                 # JSON-Schema check on workspace.toml
│   ├── emit-{pnpm,go-work,cargo,make-vars}.sh
│   ├── workspace-lock-emit.sh      # emits .dev/workspace.toml.lock.json (--check for staleness)
│   ├── docker-compose-emit.sh      # emits docker-compose.yml           (--check for CI)
│   ├── doctor.sh + doctor-checks.sh
│   ├── subtree-{assemble,lint,size-check}.sh
│   ├── schema/workspace.schema.json
│   └── test/                       # bats smoke suite
├── .claude/skills/
│   └── local-workspace-bootstrap/  # AI-runnable skill wrapping bootstrap.sh
├── packages/
│   └── orchestrator/Makefile       # 8-target package CI surface
├── ployglots/                      # symlinks → ../mta-ployglot-* siblings
├── server/
│   ├── fastify/                    # Dockerfile for @thinkeloquent/fastify-server
│   └── fastapi/                    # Dockerfile for thinkeloquent-fastapi-server
├── Makefile                        # composition root; includes Makefile.<area>
├── Makefile.vars                   # shared variables (SHELL := /bin/bash, ports, …)
├── Makefile.entries                # generated registry projection (NODE_PKGS, …)
├── Makefile.compose                # docker compose lifecycle
├── Makefile.devmode                # host-direct dev mode (no docker)
├── Makefile.lang.{node,python,go,rust}
├── Makefile.symlinks               # doctor + symlink fixers
├── Makefile.subtree                # release assembly (git subtree)
├── Makefile.projections            # .dev/workspace.toml.lock.json + docker-compose.yml emit/check
├── docker-compose.yml              # generated from workspace.toml
├── pnpm-workspace.yaml             # generated
├── go.work                         # generated
└── .env.example
```

## Workspace bootstrap

`workspace.toml` is the single source of truth. Every entry names a sibling
repo, where it lives on disk (`local_path`), and where it appears inside this
shell (`shell_path`).

```bash
make bootstrap            # clone any missing sibling, lay symlinks, regenerate manifests
make bootstrap ARGS=--dry-run
make bootstrap ARGS=--re-emit-only        # skip git fetch, just regenerate manifests
make bootstrap ARGS=--verify              # report drift, exit non-zero on diff
make bootstrap ARGS=--only=pkg-vault      # operate on one entry
```

Or invoke the script directly: `bash scripts/workspace/bootstrap.sh --help`.

The same logic is exposed as an AI-runnable skill at
`.claude/skills/local-workspace-bootstrap/SKILL.md` — phrases like _"hydrate
the workspace"_ trigger it.

### Vault override

For engineers who keep siblings in non-default locations, set
`WORKSPACE_OVERRIDE_<NAME_UPPER>=/abs/path` in your env or vault. The override
wins over `local_path` (vault-wins precedence).

## Run

Two modes: **docker** (compose-driven) or **dev** (host processes, faster
iteration).

### Docker mode

```bash
cp .env.example .env
make docker      # one-shot: build images + up + wait for healthy
make healthz     # curl both services on host ports 5100 + 5200
make smoke       # full containerized smoke (build → up → curl → down)
make down
```

Or stepwise: `make build && make up`.

| Service | Host port | Container port |
| ------- | --------- | -------------- |
| fastify | `5100`    | `3000`         |
| fastapi | `5200`    | `8080`         |

### Dev mode (host direct-run)

Needs `node`, `npm`, and [`uv`](https://github.com/astral-sh/uv) on `PATH`.

```bash
make dev           # install both stages + start both in background
make healthz       # same endpoints, same ports
make dev-logs      # tail both log files
make dev-stop

make dev-fastify   # foreground, node --watch
make dev-fastapi   # foreground, uvicorn
```

Sources stage under `.dev/{fastify,fastapi}/` (gitignored) so the symlinked
sibling stays read-only.

## Makefile architecture

The root `Makefile` is a thin composition layer. Each area lives in its own
`Makefile.<area>` fragment:

| Fragment                | Owns                                                                                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `Makefile.vars`         | shared variables (`SHELL := /bin/bash`, ports, dirs)                                                                                            |
| `Makefile.entries`      | generated registry projection (`NODE_PKGS`, …)                                                                                                  |
| `Makefile.compose`      | `init`, `build`, `up`, `down`, `healthz`, `smoke`                                                                                               |
| `Makefile.devmode`      | `dev`, `dev-fastify`, `dev-fastapi`, `dev-logs`                                                                                                 |
| `Makefile.lang.node`    | `node.install`, `node.lint`, `node.test`, `node.build`                                                                                          |
| `Makefile.lang.python`  | uv-driven equivalents                                                                                                                           |
| `Makefile.lang.go`      | `go.work`-driven equivalents                                                                                                                    |
| `Makefile.lang.rust`    | virtual `Cargo.toml` equivalents                                                                                                                |
| `Makefile.symlinks`     | `doctor`, `doctor-fix`, `symlinks-clean`                                                                                                        |
| `Makefile.subtree`      | release assembly via `git subtree`, plus `release-preflight`, `release-tag-propagate`                                                           |
| `Makefile.gates`        | Checklist gate library: `vault-check`, `addon-lint`, `twin-diff`, `security-scan`, `changelog-check`, `agent-md-check`, `pre-push`, `checklist` |
| `Makefile.orchestrator` | sibling-spanning ops: `status-all`, `sync-all`, `branch-all`, `commit-all`, `push-all` (each with a `-json` twin)                               |

`make help` walks every included fragment and prints a sectioned listing.

Adding a new area = drop a `Makefile.<area>` next to the root, add one
`-include` line — `make help` picks it up automatically.

## Doctor

`make doctor` runs cross-platform health checks against the symlink topology
and the registry. Each check returns an `ok | warn | fail` record with a
fix hint:

```bash
make doctor              # human-readable TSV
make doctor-json         # JSON for tooling
make doctor-fix          # apply auto-fixers (CONFIRM=1 required for mutations)
```

Checks include: registry validates against schema, every `shell_path` is a
relative symlink to its `local_path`, no empty git trees on `main`,
`core.symlinks` is sane for the platform, no Go `replace` directives leaking
into `go.work`.

## Multi-repo coordination

Sibling-spanning git operations that walk every entry in `workspace.toml`.
Backed by `scripts/workspace/orchestrator/_for-each-sibling.sh`; safe by
default (dry-run, refusal modes, confirmation gates). Every target has a
`-json` twin emitting one JSON-line per sibling for `jq` pipelines.

### Step-by-step: status across siblings

```bash
make status-all          # human TSV; exit 0 only if every sibling clean + on default_ref
make status-all-json     # one JSON line per sibling
make status-all-json | jq -c 'select(.dirty == true)'   # only the dirty ones
```

`make status-all` runs in <2 seconds against the full registry on a warm cache
— the helper is invoked once with `--mode parallel --json` and both the human
column view and the all-clean validation are derived from the same JSON stream.

Exit codes: `0` = all clean + on default_ref; `1` = at least one dirty / on
non-default branch; `2+` = registry not bootstrapped.

### Subset scoping with `SIBLINGS="..."`

Every sibling-op (`status-all`, `sync-all`, `branch-all`, `commit-all`,
`push-all`, plus their `-json` variants) accepts `SIBLINGS="name1 name2"` to
narrow the operation to an explicit subset. The list is intersected with the
language filter; **typos refuse loudly** so you can't silently widen scope back
to "all language-matching siblings":

```bash
make status-all SIBLINGS="pkg-vault pkg-fetch-client"
make sync-all   SIBLINGS="pkg-vault" APPLY=1
make branch-all NAME=feature/x SIBLINGS="pkg-vault pkg-figma-api"
# ERROR exits 64 if any name is unknown (and lists known siblings).
```

### Step-by-step: pull `default_ref` on every sibling

Sequence: confirm clean → dry-run preview → apply.

```bash
make status-all                       # 1. exit 0 means safe to sync
make sync-all                         # 2. dry-run; per-sibling: <NAME> | NOOP: N commits from <REF>
make sync-all APPLY=1                 # 3. perform the pull (PULLED: N commits / SKIP: <reason>)
make sync-all APPLY=1 REF=develop     # variant: pull a non-default ref
```

Per-sibling output uses the uniform sibling-op shape `<NAME> | <ACTION>[: detail]`
— consistent across `status-all` / `sync-all` / `branch-all` / `commit-all` /
`push-all`. The `-json` variant is the canonical machine contract.

Refusal modes (dirty tree, off-default branch, non-FF) emit `SKIP` — they are
not failures. Force-pull onto a dirty tree is intentionally not exposed.

### Step-by-step: spin up a coordinated feature branch

```bash
make status-all                                       # 1. confirm baseline
make sync-all APPLY=1                                 # 2. align all on default_ref
make branch-all NAME=feature/css-tokens SCOPE=all     # 3. create branch on every sibling
```

`SCOPE=touched` (default) creates only on siblings with uncommitted changes;
`SCOPE=all` creates on every sibling. A pre-flight conflict scan refuses if
the branch already exists anywhere — no branches are created if any sibling
would conflict.

### Step-by-step: coordinated commit + push

```bash
make commit-all MSG="feat(figma): tokenize header"    # commits where branch matches root's
make push-all                                         # dry-run: WOULD-PUSH summary
make push-all CONFIRM=1                               # apply (sets upstream for new branches)
```

`commit-all` refuses on protected branches (`main`, `master`, `release/*`);
`push-all` requires `CONFIRM=1` and never exposes `--force`.

## Quality gates (Checklist library)

Each step in [`Checklist.md`](./Checklist.md) maps to a `make` target;
`pre-push` runs them all in order with stop-on-fail semantics.

### Step-by-step: full pre-push validation

```bash
make pre-push                          # serial, stop-on-fail (8 gates)
make pre-push KEEP_GOING=1             # continue past first failure (CI mode)
make pre-push-json | tee /tmp/gates.jsonl   # JSON-lines for dashboards
make pre-push-full                     # pre-push + heavyweight `make ci` (~5 min)
```

Gate order: `addon-lint → vault-check → twin-diff → projections-check →
subtree-lint → security-scan → changelog-check → agent-md-check`.

#### Gate modes — CI strict vs. dev soft

Two gates honor `CI=1` to differentiate machine vs. operator runs:

| Env                  | `vault-check`                                             | `security-scan`                                                                          |
| -------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| (default, dev shell) | strict — exit 1 with remediation guidance on missing keys | warn-and-skip when `pip-audit` or both `GH_TOKEN_SECSCAN`/`GITHUB_TOKEN_SECSCAN` absent  |
| `VAULT_CHECK=warn`   | exit 0 with `WARN`; ignored under `CI=1`                  | (n/a)                                                                                    |
| `CI=1`               | strict regardless of `VAULT_CHECK`                        | hard-fail when `pip-audit` is missing or no secret-scan token is set (no silent skip)    |

Use the dev opt-out only on a local shell that intentionally has no `.env*`
sourced:

```bash
VAULT_CHECK=warn make pre-push KEEP_GOING=1   # local: skip vault-check, run the rest
```

`make security-scan` auto-detects a Verdaccio-style 404 (when the configured
npm registry is `localhost`/`127.0.0.1`/`verdaccio`) and prints the override
hint: `NPM_CONFIG_REGISTRY=https://registry.npmjs.org make security-scan`.

### Step-by-step: interactive walkthrough

```bash
make checklist           # prompts [Y/n] between gates; falls back to pre-push when CI=1 or non-TTY
```

### Individual gates

| Gate                            | Purpose                                                                                                              |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `make vault-check`              | every `process.env` / `os.environ` key referenced by either twin resolves; `CI=1` strict, `VAULT_CHECK=warn` for dev |
| `make addon-lint`               | numeric-prefix discipline on `server/{fastify,fastapi}/config/{environment,lifecycles,routes}/`                      |
| `make twin-scope FILES="…"`     | classify changed paths as fastify-only / fastapi-only / both / parity-contract / unrelated                           |
| `make twin-diff`                | detect drift between fastify ↔ fastapi (static surface + runtime route registration)                                 |
| `make security-scan`            | npm audit + pip audit + GHE secret-scanning alerts; `CI=1` hard-fails on missing `pip-audit` or secret-scan token     |
| `make secret-scan`              | standalone: query GHE Secret Scanning alerts API (`GH_TOKEN_SECSCAN` or `GITHUB_TOKEN_SECSCAN` required)             |
| `make changelog-check`          | confirm a `.changelogs/<repo>/` entry exists since merge-base                                                        |
| `make agent-md-check`           | each twin's `.agent.md` `surface-hash` marker matches its surface dirs                                               |

Each has a `-json` twin for tooling.

### Step-by-step: regenerate `.agent.md` after intentional surface change

```bash
# 1. Make the surface change (e.g. add a route under server/fastify/config/routes/).
# 2. Refresh the embedded surface-hash in every .agent.md:
make agent-md-rehash
# 3. Verify:
make agent-md-check
# 4. Commit the surface change and the .agent.md hash bump together.
```

### Secret scanning — delegated to GitHub Enterprise Advanced Security

The `secret-scan` gate does **not** run a local scanner (no gitleaks, no
trufflehog). It queries the GHAS-side scan via the REST API and fails the
gate if any open alerts exist. The server-side scan is the source of truth.

```bash
# 1. Provision a token (PAT / fine-grained / GitHub App) with
#    `secret_scanning_alerts: read` on this repo. Store it as a repo or org
#    secret. Either env-var name is accepted — GH_TOKEN_SECSCAN takes
#    priority when both are set (matches the gh CLI's GH_TOKEN > GITHUB_TOKEN
#    convention).
# 2. Local check:
GH_TOKEN_SECSCAN=ghp_… make secret-scan          # preferred
GITHUB_TOKEN_SECSCAN=ghp_… make secret-scan      # also works
# 3. CI: the workflow injects both secrets automatically — see
#    .github/workflows/release-preflight-on-pr.yml.
```

For GitHub Enterprise Server, set `GITHUB_API_URL=https://<host>/api/v3`.
GitHub Actions sets it automatically; only set it manually for local runs
against a GHE Server instance.

## Release assembly — PR-driven

The release branch is built by **copy-and-merge** (`git subtree`), not
push-to-deploy. Each sibling becomes a squashed subtree commit at its
`subtree_prefix`. Cuts are manual; **assembly happens in CI on PR merge**;
the manifest committed by the workflow is the durable record.

> **No `make release-cut` exists.** The orchestrator does not own
> release-branch creation — operators cut with plain `git`. The assembly
> workflow runs after the human-driven decision.

### Step-by-step: cut → preflight → merge → tag → propagate

```bash
# === Step 1. Cut the release branch (manual) ===
git fetch origin
git checkout -b release/2026.05.0 origin/main
git push -u origin release/2026.05.0

# === Step 2. Open a PR targeting the release branch ===
git checkout -b feature/2026-05-release-prep
# ... commit prep changes ...
git push -u origin feature/2026-05-release-prep
gh pr create --base release/2026.05.0 --title "Release 2026.05.0 prep"
#
# This triggers .github/workflows/release-preflight-on-pr.yml — runs
# `make release-preflight REF=release/2026.05.0` on root + every sibling.
# Push fixes until the check is green; cancel-in-progress=true so the
# latest commit always wins.

# (Optional) Mirror preflight locally first to save CI cycles:
make release-preflight REF=release/2026.05.0
make release-preflight-json REF=release/2026.05.0     # JSON-lines variant

# === Step 3. Merge the PR ===
gh pr merge --merge
#
# This triggers .github/workflows/release-assemble-on-pr-merge.yml. CI:
#   1. hydrates siblings + runs `make doctor`
#   2. snapshots each sibling's HEAD SHA, then runs
#      `git subtree pull --squash --prefix=<shell_path> <remote> <sha>`
#      for every sibling
#   3. emits .dev/release-manifests/release-2026-05-0.toml + .lock.jsonl
#   4. commits the manifest + subtree commits atomically
#   5. pushes the release branch
#   6. posts a status comment on the merged PR

# === Step 4. Tag the orchestration root (manual) ===
git fetch origin
git checkout release/2026.05.0
git pull --ff-only
git tag v2026.05.0
git push origin v2026.05.0

# === Step 5. Propagate the tag back to source siblings ===
make release-tag-propagate TAG=v2026.05.0 REF=release/2026.05.0           # dry-run
make release-tag-propagate TAG=v2026.05.0 REF=release/2026.05.0 CONFIRM=1 # apply
```

Tag-propagate reads `.dev/release-manifests/release-2026-05-0.toml` and
pushes `v2026.05.0` to each sibling at the SHA the workflow recorded.
Idempotent on match; reports `CONFLICT` (and exits 1) if a sibling has the
tag at a different SHA — pass `FORCE=1` only after investigating.

### Step-by-step: reproduce a past assembly locally

`make release-assemble` is reproduction-only — it **requires** `MANIFEST=`
and refuses without one.

```bash
git checkout release/2026.05.0
make release-assemble \
    REF=release/2026.05.0 \
    MANIFEST=.dev/release-manifests/release-2026-05-0.toml
```

Without `MANIFEST=`, the target prints a hint pointing at the PR-merge
workflow.

### Workflows

| File                                                 | Trigger                                                | Job                                                                                        |
| ---------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `.github/workflows/release-preflight-on-pr.yml`      | PR `opened/synchronize/reopened` against `release/**`  | run `make release-preflight REF=<base>` (root `pre-push` + per-sibling gate); blocks merge |
| `.github/workflows/release-assemble-on-pr-merge.yml` | PR `closed` with `merged == true` against `release/**` | hydrate, subtree-pull at HEAD, write manifest, commit + push atomically, comment on PR     |

The old push-triggered `.github/workflows/release-assemble.yml` is
**deleted**. Branch protection on `release/**` must now require the
`Release Preflight (on PR)` check (out-of-band; one-time setup).

### Manifest schema

Each assembly emits a TOML manifest (`.dev/release-manifests/<ref-slug>.toml`)
plus a `.lock.jsonl` projection. Schema: `scripts/workspace/release-manifest.schema.json`;
example: `scripts/workspace/release-manifest.example.toml`.

```toml
release_ref = "release/2026.05.0"
cut_at = "2026-05-12T14:32:01Z"
cut_by = "github-actions[bot]"

[[sibling]]
name = "mta-ployglot-server-bootstrap"
sha = "3a1fc9a0e8b2..."
from_ref = "main"
remote = "https://github.com/thinkeloquent/mta-ployglot-server-bootstrap.git"

[[sibling]]
name = "mta-ployglot-pkg-vault"
sha = "1b3de2c4f5a7..."
from_ref = "main"
remote = "https://github.com/thinkeloquent/mta-ployglot-pkg-vault.git"
```

### Subtree guards

```bash
make subtree-lint                          # forbid `git subtree (add|pull|merge)` without --squash
make subtree-size-check                    # compare .git/ size against pre-assembly snapshot
make subtree-rollback FROM=<sha>           # dry-run; CONFIRM=1 to apply
make subtree-rollback-push CONFIRM=1       # force-with-lease push the rollback
```

## Per-package CI Makefile

`packages/orchestrator/Makefile` and
`.claude/skills/local-workspace-bootstrap/Makefile` each ship the canonical
8-target contract:

```
help install ci-install lint test build clean ci
```

`make ci` from either package runs `ci-install → lint → test → build`. The
orchestrator package wraps subtree-lint, the bats suite, emitter idempotency,
and `doctor` into one pipeline.

## Hardening (docker images)

Both Dockerfiles ship with:

- Pinned base image digests (no floating `:latest`).
- Non-root runtime user (`node` in fastify, `app` in fastapi).
- `tini`/`--init` as PID 1 for correct signal handling.
- Read-only root filesystem in compose, with tmpfs for `/tmp`.
- `cap_drop: [ALL]` + `security_opt: [no-new-privileges:true]`.

This is **limited hardening** appropriate for dev/staging traffic. It is not
a production posture — no distroless base, no secret vault, no image scanning
gate, no resource limits.

## Day-to-day & CI — managing an existing project

For a working clone where `make bootstrap` has already run at least once.
These are the recurring operations.

**1. Sync with upstream.**

```bash
git pull
make bootstrap                     # re-runs the emit chain after any workspace.toml change
```

`bootstrap` is idempotent: missing siblings get cloned, present ones are
left alone, and every derived projection is refreshed. If a teammate added
a new sibling to `workspace.toml`, this is the only step you need.

**2. Add or rename a sibling.**

The SSOT is `workspace.toml`. Edit it, then regenerate every projection.

```bash
# 1. Edit workspace.toml — add/remove/rename an [[entry]].
# 2. Validate the schema:
bash scripts/workspace/validate.sh workspace.toml
# 3. Regenerate every projection (manifests, lock, compose):
make bootstrap ARGS=--re-emit-only
# 4. Sanity-check:
make projections-check             # all derived files in sync with workspace.toml
make doctor                        # symlinks + topology healthy
# 5. Commit (only the SSOT + the *committed* projection — docker-compose.yml.
#    Lock JSON and per-language manifests are generated and gitignored.):
git add workspace.toml docker-compose.yml
git commit -m "feat(workspace): add <sibling-name>"
```

CI will refuse a PR that edits `workspace.toml` without re-emitting the
projections — `make projections-check` exits 69 with a unified diff.

**3. Run the full CI pipeline locally.**

```bash
make ci-local                      # doctor → projections-check → subtree-lint → ci-install → lint → test → build
```

Equivalent to what GitHub Actions runs on every PR; if it's green here, the
remote build will pass.

**4. Run quality gates piecemeal.**

| Concern                                 | Command                                                 |
| --------------------------------------- | ------------------------------------------------------- |
| Schema-validate the registry            | `bash scripts/workspace/validate.sh workspace.toml`     |
| Confirm every projection is in sync     | `make projections-check`                                |
| Regenerate one projection               | `make workspace-lock-emit` / `make docker-compose-emit` |
| Cross-platform topology health          | `make doctor`                                           |
| Subtree invocations are `--squash`-only | `make subtree-lint`                                     |
| Per-language linters/tests/builds       | `make node.lint`, `make python.test`, …                 |
| Containerized smoke (build → up → curl) | `make smoke`                                            |

**5. Cut and assemble a release branch (PR-driven).**

Cuts are manual; assembly happens in CI on PR merge. See
[Release assembly — PR-driven](#release-assembly--pr-driven) above for the
full step-by-step. The condensed loop:

```bash
git checkout -b release/2026-04-25 origin/main && git push -u origin release/2026-04-25  # 1. cut
gh pr create --base release/2026-04-25 --title "Release 2026-04-25 prep"                 # 2. preflight on PR
gh pr merge --merge                                                                      # 3. assembly on merge (CI)
git tag v2026-04-25 && git push origin v2026-04-25                                       # 4. tag root
make release-tag-propagate TAG=v2026-04-25 REF=release/2026-04-25 CONFIRM=1              # 5. propagate to siblings
```

Local reproduction of a past assembly (debugging only):

```bash
make release-assemble REF=release/2026-04-25 \
    MANIFEST=.dev/release-manifests/release-2026-04-25.toml
```

Rollback if a CI assembly went sideways:

```bash
git log --oneline                          # find the pre-assembly SHA
make subtree-rollback FROM=<sha> CONFIRM=1
make subtree-rollback-push CONFIRM=1       # force-with-lease push the rollback
```

**6. Update one sibling's pinned ref for the next release.**

Bump the `default_ref` field for the entry in `workspace.toml` (a tag or SHA
pulls in determinism), then re-emit, commit, and re-assemble.

```bash
$EDITOR workspace.toml                     # change default_ref = "v1.4.2" (etc.)
make bootstrap ARGS=--re-emit-only
git add workspace.toml
git commit -m "chore(workspace): pin <sibling> to v1.4.2"
```

The next `release-assemble` will pick up the pinned ref.

**7. CI workflows.**

Two workflows replace the old push-triggered `release-assemble.yml`:

| File                                                 | Trigger                                                | Effect                                                                                    |
| ---------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `.github/workflows/release-preflight-on-pr.yml`      | PR open/sync/reopen targeting `release/**`             | runs `make release-preflight` on root + every sibling; blocks merge on failure            |
| `.github/workflows/release-assemble-on-pr-merge.yml` | PR `closed` with `merged == true` against `release/**` | hydrate → subtree-pull at HEAD → emit manifest → commit atomically → push → comment on PR |

A stale projection, a non-`--squash` subtree call, or any failed gate blocks
the merge before assembly runs. On any failure, the partial tree is uploaded
as an artifact for forensics.

**8. Daily multi-repo loop.**

For day-to-day work that touches multiple siblings, the
[Multi-repo coordination](#multi-repo-coordination) and
[Quality gates](#quality-gates-checklist-library) sections cover:

- `make status-all` — cross-sibling git state in one command (under 2 sec on warm cache)
- `make status-all SIBLINGS="vault fetch-client"` — narrow any sibling-op to a subset
- `make sync-all APPLY=1` — pull `default_ref` everywhere
- `make branch-all NAME=feature/X` — coordinated feature-branch creation
- `make commit-all MSG="…"` / `make push-all CONFIRM=1` — coordinated push
- `make checklist` (interactive) or `make pre-push` (CI) — Checklist gates
- `VAULT_CHECK=warn make pre-push KEEP_GOING=1` — local opt-out when no `.env*` is sourced

The opt-in pre-push hook at `scripts/git-hooks/pre-push.sample` runs
`make pre-push` automatically; enable with
`git config core.hooksPath scripts/git-hooks`.

## Workspace registry

`workspace.toml` is the single source of truth for sibling-repo topology. To produce a Markdown summary suitable for plan-arg tables:

```bash
bash scripts/workspace/print-registry.sh > /tmp/registry.md
```

The output is one row per `[[entry]]` block. Pipe through `pbcopy` (macOS) or `xclip -selection clipboard` (Linux) to drop into a planning doc.

## License

MIT.
