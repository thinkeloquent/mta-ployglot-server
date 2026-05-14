# Integration tests

Real network tests. Skipped when the required env vars are missing.

## Running

```bash
# Default: a minimal HTTP smoke test against httpbin.org
make -C packages/py test-integration

# Provider-specific suites (only the ones with creds set will run)
GITHUB_PASS=ghp_xxx make -C packages/py test-integration
JIRA_HOST=https://acme.atlassian.net JIRA_USER=you JIRA_PASS=tok \
  make -C packages/py test-integration
```

## Env gates

| Test file                 | Env required                                 | Target                                       |
| ------------------------- | -------------------------------------------- | -------------------------------------------- |
| `test_http_smoke.py`      | none (uses httpbin.org)                      | end-to-end GET/POST through real httpx pool |
| `test_github_live.py`     | `GITHUB_PASS`                                | `GET /user`                                  |
| `test_jira_live.py`       | `JIRA_HOST`, `JIRA_USER`, `JIRA_PASS`        | `GET /rest/api/3/myself`                     |
| `test_saucelabs_live.py`  | `SAUCELABS_HOST`, `SAUCELABS_USER`, `_PASS`  | `GET /rest/v1/users/{u}/concurrency`         |

Integration tests that can't reach their target are emitted with `pytest.skip`
(not failed), so a partial credential set leaves the suite green.
