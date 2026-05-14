# SDK Examples

Programmatic usage of `@mta/github-projects` from a Node ESM host application.

## Setup

```bash
# From any consuming project:
npm install @mta/github-projects undici

# Inside this repo (already installed via the workspace):
npm install
```

```js
import { createClient } from '@mta/github-projects';

const client = createClient({
  token: process.env.GITHUB_TOKEN,
  // host: 'github.acme.corp',          // optional — Enterprise Server
  // proxy: 'http://proxy.acme:3128',   // optional — corporate proxy
  // retry: { maxAttempts: 3, baseDelayMs: 250 },  // optional
});
```

## Scenarios

| #   | Scenario                                                                                | Description                                                  |
| --- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 01  | [Create and read a project](01-create-and-read-project.md)                              | `projects.create` + `projects.get` round trip.               |
| 02  | [List items with field values](02-list-items-with-values.md)                            | Async iteration via `paginate`; eager-loaded `fieldValues`.  |
| 03  | [Set a single-select value by name](03-set-status-by-name.md)                           | Auto-resolves option name → id under the hood.               |
| 04  | [Bulk move items across status](04-bulk-move-status.md)                                 | `bulk.moveStatus` with concurrency + rate-limit throttle.    |
| 05  | [Custom HOST + proxy configuration](05-enterprise-host-with-proxy.md)                   | Construct a client for GHES behind a corporate proxy.        |
| 06  | [Manage sub-issues](06-sub-issues.md)                                                   | `relations.subIssues.add/list/remove/reorder/reparent`.      |
