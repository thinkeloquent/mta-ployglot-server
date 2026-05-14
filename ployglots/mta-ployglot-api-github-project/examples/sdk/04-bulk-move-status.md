# SDK Example: Bulk move items across status

## Goal

Move 50 project items to the `Done` column under a bounded concurrency cap with built-in token-bucket throttling so secondary rate limits don't trip.

## Prerequisites

- `GITHUB_TOKEN` with `project` scope.
- `PROJECT_ID`, `STATUS_FIELD_ID` (a `SINGLE_SELECT` field), and `DONE_OPTION_ID`.
- An array of 50 `itemIds` to move.

## Code

```js
import { createClient } from '@mta/github-projects';

const client = createClient({ token: process.env.GITHUB_TOKEN });
const { PROJECT_ID, STATUS_FIELD_ID, DONE_OPTION_ID } = process.env;

// Fetch the items first, then bulk-move them.
const itemIds = [];
for await (const item of client.items.list(PROJECT_ID)) {
  itemIds.push(item.id);
  if (itemIds.length >= 50) break;
}

const result = await client.bulk.moveStatus(
  PROJECT_ID,
  { statusFieldId: STATUS_FIELD_ID, optionId: DONE_OPTION_ID },
  itemIds,
  { concurrency: 5 },
);

console.log(`ok: ${result.ok.length}, failed: ${result.failed.length}`);
for (const f of result.failed) {
  console.error(`  ${f.input}: ${f.error.message}`);
}
```

## Expected outcome

```
ok: 50, failed: 0
```

Or, with a partial failure:

```
ok: 47, failed: 3
  PVTI_x1: secondary rate limit hit after retries
  PVTI_x2: Could not resolve to a node with the global id
  PVTI_x3: HttpError: 502 Bad Gateway
```

## Notes

- `BulkResult` is intentionally non-throwing — partial success is the common case for batch operations. Check `result.failed.length === 0` and throw yourself if you want all-or-nothing.
- The default token-bucket is 80 mutations / 60s. Override with `{ bucket: tokenBucket({ tokens: 40, intervalMs: 60_000 }) }` from `@mta/github-projects/bulk/token-bucket.mjs` if you want a tighter ceiling.
- `bulk.assignField`, `bulk.updateItems`, and `bulk.bulkAdd` follow the same shape.
