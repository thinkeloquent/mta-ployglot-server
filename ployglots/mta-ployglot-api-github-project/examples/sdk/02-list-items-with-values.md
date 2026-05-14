# SDK Example: List items with field values

## Goal

Iterate every item in a project, page-by-page under the hood, and read its eager-loaded `fieldValues` (text, number, date, single-select, iteration, user).

## Prerequisites

- `GITHUB_TOKEN` with `project` scope.
- `PROJECT_ID` — the node id of an existing project (e.g. `PVT_kwDOABCDE`).

## Code

```js
import { createClient } from '@mta/github-projects';

const client = createClient({ token: process.env.GITHUB_TOKEN });
const projectId = process.env.PROJECT_ID;

let count = 0;
for await (const item of client.items.list(projectId, { fields: ['Status', 'Priority'] })) {
  count++;
  const status = item.fieldValues.find(v => v.fieldName === 'Status');
  const priority = item.fieldValues.find(v => v.fieldName === 'Priority');
  console.log(
    `${item.id} ${item.content?.title ?? '(draft)'} `
    + `[${status?.value?.optionName ?? '-'} | ${priority?.value?.optionName ?? '-'}]`,
  );
}
console.log(`${count} items`);
```

## Expected outcome

```
PVTI_a1 Migrate auth middleware [In Progress | High]
PVTI_a2 Audit feature flags     [Todo        | Medium]
PVTI_a3 Roll out caching        [Done        | Low]
3 items
```

## Notes

- The `fields:` filter is applied client-side after the page returns; passing it just narrows the per-item `fieldValues` array, not the items themselves.
- The async iterator follows `pageInfo.endCursor` until `hasNextPage: false`. Pages are 50 items by default.
