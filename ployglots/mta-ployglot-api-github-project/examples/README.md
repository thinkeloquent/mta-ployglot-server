# Examples

End-to-end, runnable samples for each surface this repo delivers.

| Surface | Folder            | Status                                                       |
| ------- | ----------------- | ------------------------------------------------------------ |
| SDK     | [`sdk/`](sdk/)    | **Delivered.** Real scenarios using `@mta/github-projects`.  |
| CLI     | [`cli/`](cli/)    | **Not delivered.** See the folder README for context.        |
| API     | [`api/`](api/)    | **Delivered.** Public function/method contract reference.    |

## Conventions

- Every example is self-contained: prerequisites, setup, the run, and expected output.
- Examples assume the package is installed (`npm install` from the repo root).
- Auth comes from the `GITHUB_TOKEN` environment variable — never hardcoded.
- Examples double as smoke tests — they should be runnable end-to-end against a real GitHub project.
- A token with the `project`, `read:org`, `repo` scopes is sufficient for most scenarios.

## Quick smoke check

```bash
export GITHUB_TOKEN=ghp_xxx
node examples/sdk/01-create-and-read-project.mjs
```
