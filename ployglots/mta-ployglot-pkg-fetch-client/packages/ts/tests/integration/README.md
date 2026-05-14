# Integration tests

End-to-end tests that hit live provider APIs. They follow the same env-var
convention as `examples/integrations/`:

- `<SERVICE>_HOST`, `<SERVICE>_USER`, `<SERVICE>_PASS`
- `HTTPS_PROXY` / `HTTP_PROXY` for optional outbound proxy

Tests are skipped (via `it.skipIf(...)`) when the required env vars are
missing, so a developer without credentials for every provider can still run
the suite cleanly.

## Run all integration tests

```bash
make -C packages/ts test-integration
```

(Equivalent: `npx vitest run --config vitest.integration.config.ts`.)

## Run only one provider

```bash
JIRA_HOST=https://acme.atlassian.net \
JIRA_USER=you@acme.com \
JIRA_PASS=$(pass jira-token) \
npx vitest run --config vitest.integration.config.ts integrations.test.ts -t jira
```

## Adding a new provider

1. Add the env vars + service contract to `examples/integrations/<provider>.ts`.
2. Add an `it.skipIf(missing(['<SVC>_HOST', '<SVC>_USER', '<SVC>_PASS']))` block
   in `integrations.test.ts` that builds the same client and asserts the
   smallest plausible response shape.
