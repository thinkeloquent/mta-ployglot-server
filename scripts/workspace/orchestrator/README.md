# Orchestrator helpers

Shell helpers backing the `Makefile.orchestrator` (multi-repo coordination)
and `Makefile.gates` (Checklist.md gate library) fragments at the repo root.

Designed to run on macOS bash 3.2 and Linux bash 4+ alike — no `mapfile`,
no `wait -n`, no `${var^^}`. Tools required: `git`, `jq`, `python3`, `node`.
Optional: `pip-audit` (security-scan), `bats` (running the test suite).
Secret scanning is delegated to GitHub (Enterprise) Advanced Security via the
REST API — `secret-scan-ghe.sh` reads open alerts using `$GITHUB_TOKEN_SECSCAN`
(no local scanner installed or invoked).

## Layout

```
orchestrator/
├── _for-each-sibling.sh        # iteration primitive (Makefile.orchestrator)
├── sibling-{status,sync,branch,commit,push}.sh  # per-sibling probes
├── sibling-gate.sh             # per-sibling Checklist gate dispatch (F03 S02)
├── sibling-tag.sh              # per-sibling idempotent tag-and-push (F03 S05)
├── extract-vault-keys.sh       # env-key extractor (process.env / os.environ)
├── addon-lint.sh               # numeric-prefix discipline
├── twin-{scope,diff}.sh        # twin parity tooling
├── secret-scan-ghe.sh          # query GHE Secret Scanning alerts via REST API
├── changelog-check.sh          # .changelogs/<repo>/ entry presence gate
├── agent-md-{check,rehash}.sh  # content-hash gate for .agent.md surface
├── checklist-walker.sh         # interactive [Y/n] runner over pre-push gates
├── emit-assembly-manifest.sh   # write release-manifest TOML+JSONL (F03 S03)
├── validate-release-manifest.sh # pre-assembly validator (F03 S04)
├── Makefile                    # per-package CI (lint+test+build of these scripts)
├── lib/
│   ├── log.sh                  # color-aware logging
│   ├── registry.sh             # reads .dev/workspace.toml.lock.json
│   ├── twin-surface.sh         # surface extractors (routes/lifecycles/env)
│   ├── sibling-snapshot.sh     # capture sibling HEAD SHAs (F03 S03)
│   ├── manifest.sh             # release-manifest reader/validator (F03 S01)
│   ├── manifest-emit.sh        # release-manifest emitter (F03 S01)
│   ├── _toml_to_json.py        # Python tomllib shim (F03 S01)
│   └── _manifest_validate.py   # hand-rolled schema validator (F03 S01)
├── probes/
│   ├── vault-probe.mjs         # check process.env keys
│   └── vault-probe.py          # check os.environ keys
└── tests/
    ├── _for-each-sibling.bats  # iteration primitive contract tests
    ├── sibling-sync.bats       # refusal mode contract tests
    ├── test_helper.bash        # common bats setup
    └── fixtures/
        └── workspace.toml.lock.json
```

Sibling to this directory:
- `scripts/workspace/release-manifest.schema.json` — JSON Schema for the
  release manifest TOML.
- `scripts/workspace/release-manifest.example.toml` — example fixture.
- `scripts/workspace/release-assemble-from-siblings.sh` — workflow-driven
  subtree pull at sibling HEAD SHAs (F03 S03).
- `.github/workflows/release-preflight-on-pr.yml` — PR-check workflow
  running `make release-preflight` (F03 S02).
- `.github/workflows/release-assemble-on-pr-merge.yml` — PR-merge workflow
  running the assembly + manifest emission + push (F03 S03). Replaces the
  old push-triggered `release-assemble.yml`.

## Deviations from the original plan

The plan was authored before the actual repo state was inspected. These
adaptations are intentional:

1. **No vault module.** The plan assumed `vault.get('KEY')`. The codebase
   reads `process.env.X` (mjs) and `os.environ.get("X")` (py) directly.
   The `make vault-check` target name is preserved for Checklist.md
   alignment, but the extractor matches the real patterns. Documented at
   the top of `extract-vault-keys.sh`.

2. **Routes prefix range widened to 10–99.** Plan said routes use 30–49 and
   added a collision check. Reality: `10_healthz.routes.*`, `30_*.routes.*`,
   `99_wildcard.routes.*` all coexist by convention. Multiple `30_*` files
   is the *intended* grouping (one per integration). `addon-lint` now
   enforces only missing/non-numeric/out-of-range; collisions are allowed.

3. **`make changelog` wrapper dropped.** The `/ployglot-changelog` skill is
   the canonical entry point and runs in the harness, not the shell.
   Wrapping it in a make target would print copy-paste hints; not worth it.
   Only the `changelog-check` gate exists.

4. **`agent-md-check` is content-hash, not mtime.** Per the plan revision —
   embeds `<!-- surface-hash: <16-char-sha256-prefix> -->` in each
   `.agent.md`. Survives `touch`, catches actual edits.

5. **`pre-push` excludes `make ci`.** That target runs the full CI pipeline
   (`projections-check → subtree-lint → ci-install → lint → test → build`),
   ~5 minutes when toolchains are missing. `pre-push` runs the same drift
   signals (`projections-check` + `subtree-lint`) plus the other gates and
   completes in ~3 seconds. `make pre-push-full` includes `ci` for the
   heavyweight check.

6. **FastAPI runtime route emitter degrades gracefully.** Loading
   `30_*.routes.py` requires `fetch_http_client`, `httpx`, etc., which may
   not be in the venv this shell sees. The emitter prefers
   `server/fastapi/.venv/bin/python` if present, falls back to system
   `python3`, and `twin-diff` falls back to static if runtime emits no
   routes. No crash; just a `WARN` in the diff output.

7. **bash 3.2 compatibility.** `mapfile`, `wait -n`, and `${var^^}` were
   replaced with `while-read`, batched parallel, and `tr` respectively.
   This makes the helpers portable to macOS's system bash. Existing repo
   scripts use `mapfile` — tracked separately.

8. **`ajv`/`jsonschema` not used.** The plan suggested `ajv validate` for
   manifest schema validation; neither `ajv` nor Python `jsonschema` was
   available on the dev machine. Replaced with a hand-rolled validator
   (`lib/_manifest_validate.py`, ~80 lines) that checks every constraint
   the schema declares: required keys, `release_ref` pattern, 40-hex SHAs,
   duplicate names, non-empty strings. Schema file is still authoritative
   and machine-readable; the Python validator just reads it directly.

9. **Manifest re-include in `.gitignore`.** `.dev/` is gitignored, but the
   PR-merge workflow commits `.dev/release-manifests/<slug>.toml` to the
   release branch as the durable assembly record. Switched `.gitignore`
   from `.dev/` to `.dev/*` + `!.dev/release-manifests/` (gitignore can't
   re-include children of a fully-excluded parent directory).

10. **`.dev/snapshot.jsonl` is `/tmp/snapshot.jsonl`.** The transient
    snapshot (per-sibling HEAD SHAs at assembly start) lives in `/tmp` so
    it never leaks into git state. The committed record is the manifest.

11. **`scripts/workspace/subtree-assemble.sh` was NOT deleted.** The plan
    mandates deletion ("logic moved to `release-assemble-from-siblings.sh`"),
    but only the `assemble` verb was ported. The legacy script's other two
    verbs have no replacement yet:
    - `verify` — `doctor + make ci + assert-real-dirs`; called by
      `Makefile.subtree:194` (`release-verify`).
    - `assert-real-dirs` — checks every `subtree_prefix` entry in
      `workspace.toml` is a real directory.

    Retaining the script preserves `release-verify` without expanding scope.
    `Makefile.subtree:43` (`SUBTREE_ASSEMBLE` variable) and
    `Makefile.subtree:194` (`release-verify`) remain unchanged. Follow-up
    tracked under the plan tree at
    `orchestrator-multi-repo-release-20260425-7e3a9c1b-todos/port-subtree-assemble-verify-verbs.md`
    (week 17).

12. **Sibling-op human output is `<NAME> | <ACTION>[: detail]`, not the
    multi-column spec.** The plan stories named these formats:
    - `sync-all` (Story 01/03 AC4): `name | from-ref → to-ref | N commits | OK|SKIP(reason)`
    - `branch-all` (Story 01/04 AC6): `name | created from <branch>@<short-sha> | OK|SKIP|EXISTS`
    - `commit-all` / `push-all` (Story 01/05 AC5): final aggregate `N committed, M skipped, K failed`

    Implementation emits a single `<NAME> | <ACTION>[: <detail>]` line per
    sibling with a `N/M siblings ok` summary from `_for-each-sibling.sh`. This
    is the same shape every sibling-op uses — identical parsing across
    `status-all` / `sync-all` / `branch-all` / `commit-all` / `push-all`. The
    machine-readable contract is the `<op>-json` variant, which is
    column-stable. The human format prioritizes single-script consistency
    over per-AC column shapes; downstream tooling consumes the JSON variant.

13. **`SIBLINGS=` subset filter is implemented across every sibling-op.** Story
    01/04 AC3 named only `branch-all`; the helper-level `--siblings "name1
    name2"` flag and the `Makefile.orchestrator` `ORCH_SIBLINGS_FLAG` were
    plumbed through `status-all` / `sync-all` / `branch-all` / `commit-all` /
    `push-all` so subset scoping is a uniform property of every sibling-op,
    not a per-target opt-in. Refuses on unknown sibling names so a typo
    cannot silently widen scope to "all language-matching siblings".

## CI

```
cd scripts/workspace/orchestrator
make ci
```

Runs `shellcheck` (if installed) + the full bats suite. Currently
`shellcheck` is not installed on the dev machine — install it with
`brew install shellcheck` to enable the lint step.
