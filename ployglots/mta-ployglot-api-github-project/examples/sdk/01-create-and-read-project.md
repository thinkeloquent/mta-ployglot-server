# SDK Example: Create and read a project

## Goal

Create a new ProjectV2 under an organization, then read it back by `(owner, number)` and confirm the fields match.

## Prerequisites

- `GITHUB_TOKEN` env var with the `project` scope on the target organization.
- The org's node id (`OWNER_ID`) — fetch once with `gh api graphql -f query='{ organization(login:"acme"){ id } }'`.

## Code

```js
import { createClient } from '@mta/github-projects';

const client = createClient({ token: process.env.GITHUB_TOKEN });
const ownerId = process.env.OWNER_ID;

const created = await client.projects.create({
  ownerId,
  title: 'Q2 Roadmap',
});
console.log('created:', created.id, created.number, created.title);

const fetched = await client.projects.get({
  owner: 'acme',
  number: created.number,
});
console.log('fetched:', fetched.title, fetched.url);

await client.projects.close(created.id);
console.log('closed');
```

## Expected outcome

```
created: PVT_kwDOABCDE 17 Q2 Roadmap
fetched: Q2 Roadmap https://github.com/orgs/acme/projects/17
closed
```

## Notes

- `projects.close` is reversible via `projects.reopen`. Use `projects.delete` for permanent removal.
- `projects.get` queries both the `organization` and `user` GraphQL branches; the SDK returns whichever is non-null.
