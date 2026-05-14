# release-assemble Workflow — Operator Setup

A one-pager covering the GitHub App + secret + concurrency story for the
`.github/workflows/release-assemble.yml` workflow. Read this once when you
inherit the runbook; refer to the failure-mode table when something breaks.

## What the workflow does

On every push to `release/**` (or manual `workflow_dispatch`) it:

1. Checks out the release branch with a token that can clone every sibling.
2. Runs `make doctor`, `make subtree-lint`, `make release-assemble REF=$REF`.
3. Verifies `.git/` size delta + that every `subtree_prefix` is now a real directory.
4. Pushes the assembled branch back with `--force-with-lease`.
5. On failure, uploads `ployglots/` and the lock files as a build artifact for forensic review.

The recipes themselves are the executable contract — the workflow is the trigger.

## Prerequisites

### 1. Create a GitHub App

Name it something like `<org>-release-assemble`. Required permissions:

| Resource         | Access |
| ---------------- | ------ |
| Repository contents | Read & Write (write only on the orchestration repo; read elsewhere) |
| Repository metadata | Read |

Subscribe to no events — the workflow doesn't need webhooks.

### 2. Install the App

Install on:

- The orchestration repo (this one).
- Every sibling repo listed in `workspace.toml`. To enumerate:

  ```bash
  python3 -c "
  import tomllib
  for e in tomllib.load(open('workspace.toml','rb'))['entry']:
      print(e['remote'])
  "
  ```

### 3. Generate the installation token

Use the App's installation-token endpoint or a tool like `tibdex/github-app-token@v2`. Store the resulting token as the orchestration repo's `RELEASE_ASSEMBLE_TOKEN` secret (Actions → Secrets and variables → Repository secrets).

Token rotation: GitHub installation tokens auto-expire in ~1 hour. The workflow re-mints on every run, so cache lifetime is irrelevant; just keep the App's private key in the secret manager and use a small token-mint action ahead of `actions/checkout`.

## Concurrency

`concurrency.group` is keyed on the release branch name. Two pushes to the same `release/*` branch enqueue (`cancel-in-progress: false`) so the second waits for the first to finish, not race against it.

A push to a different release branch (e.g. `release/v1.3.0` while `release/v1.2.0` is mid-assembly) runs in parallel — they have different concurrency groups.

## Operator failure modes

| Symptom | Cause | Recovery |
|---------|-------|----------|
| Workflow stuck on "Waiting for runner" with another running | Concurrency queue is doing its job. Wait for the first run to finish. | Nothing — by design. |
| `--force-with-lease` rejected | Someone (you?) pushed a commit to the release branch between this run starting and finishing. | Rerun the workflow; the new HEAD will be the assembly base. |
| Workflow exits 75 in `make release-assemble` | Stale `.git/.subtree-assemble.lock.d/` from an aborted prior run on a self-hosted runner. | SSH to the runner, `rm -rf .git/.subtree-assemble.lock.d .git/.subtree-assemble.lock`, rerun. |
| `subtree-lint` fails | Someone added `git subtree add` (or pull/merge) without `--squash` to a Makefile or workflow file. | Required: add `--squash`. The lint catches `add\|pull\|merge`. |
| `subtree-size-check` fails | `.git/` grew by more than `SUBTREE_SIZE_CAP_MB` (default 50 MB) — likely a missing `--squash` got past the lint. | Bisect the latest assembly's commits; expect to find an unsquashed merge. Rebuild with `make release-assemble` after fixing the source of the leak. |
| `partial-assembly-*` artifact uploaded | Workflow failed mid-assembly. | Download the artifact, inspect the partial state, then run `make subtree-rollback FROM=<pre-assembly-sha> CONFIRM=1` followed by `make subtree-rollback-push CONFIRM=1`. |

## Token scope verification

After installing the App, smoke-test the token:

```bash
# Replace with your installation token.
TOKEN="$(...)"
python3 -c "
import tomllib, urllib.request, os, sys
for e in tomllib.load(open('workspace.toml','rb'))['entry']:
    url = e['remote'].replace('.git','').replace('https://github.com/', 'https://api.github.com/repos/')
    req = urllib.request.Request(url, headers={'Authorization': f'Bearer {os.environ[\"TOKEN\"]}'})
    try:
        urllib.request.urlopen(req, timeout=5)
        print(f'ok: {e[\"name\"]}')
    except Exception as ex:
        print(f'FAIL: {e[\"name\"]}: {ex}')
"
```

Every line should print `ok:`. A `FAIL:` means the App isn't installed on that sibling — fix before merging.

## Branch protection

Recommended on `release/*`:

- Require status check `release-assemble / assemble` to pass.
- Disallow force-push from anyone except `release-assemble[bot]`.
- Require at least one review on PRs that target `release/*` (the workflow only runs on push, but the PR gate prevents accidents).
