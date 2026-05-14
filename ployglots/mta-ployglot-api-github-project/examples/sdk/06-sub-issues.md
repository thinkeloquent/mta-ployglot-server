# SDK Example: Manage sub-issues

## Goal

Build a small parent → sub-issue tree, reorder children, and reparent one of them. Sub-issues are a separate API from Projects v2 — they live on the underlying `Issue`.

## Prerequisites

- `GITHUB_TOKEN` with `repo` scope.
- A `parentRef` and a few `childRef`s. Refs accept either a node id (`'I_kwDOABC123'`) **or** a `{ owner, repo, number }` object.

## Code

```js
import { createClient } from '@mta/github-projects';

const client = createClient({ token: process.env.GITHUB_TOKEN });

const parent = { owner: 'acme', repo: 'platform', number: 100 };
const child1 = { owner: 'acme', repo: 'platform', number: 101 };
const child2 = { owner: 'acme', repo: 'platform', number: 102 };
const child3 = { owner: 'acme', repo: 'platform', number: 103 };

// Add three sub-issues
await client.relations.subIssues.add(parent, child1);
await client.relations.subIssues.add(parent, child2);
await client.relations.subIssues.add(parent, child3);

// Read the tree
const subs = await client.relations.subIssues.list(parent);
console.log('children:', subs.map(s => s.number));

// Reorder: put child3 first
await client.relations.subIssues.reorder(parent, [child3, child1, child2]);

// Reparent: move child2 under a different parent
const newParent = { owner: 'acme', repo: 'platform', number: 200 };
await client.relations.subIssues.reparent(child2, newParent);

// Remove child1 from the original parent
await client.relations.subIssues.remove(parent, child1);
```

## Expected outcome

```
children: [ 101, 102, 103 ]
```

After all operations:

- `acme/platform#100` has `[103, 102]` as sub-issues (in that order, before the remove)
- After remove: `acme/platform#100` has `[103]`
- `acme/platform#200` has `[102]`
- Removing a sub-issue does **not** delete the issue itself — both #100 and #102 still exist.

## Notes

- `reparent` is a two-call helper: `GET` the child to find its current parent, `DELETE` the old link, then `POST` the new one.
- Sub-issue endpoints take **numeric** ids (`databaseId`); the SDK resolves node ids → numeric automatically via the issue-ref resolver.
- For dependency tracking (blocks/blocked-by), use `client.relations.dependencies.*` instead — that surface uses a `Blocked by` text field convention rather than the sub-issue REST API.
