# SDK Example: Set a single-select value by name

## Goal

Set an item's `Status` field to `Done` by passing the option **name** (not id). The SDK fetches the field schema once, caches it, and resolves `'Done'` → the matching `optionId`.

## Prerequisites

- `GITHUB_TOKEN` with `project` scope.
- `PROJECT_ID`, `ITEM_ID`, and `STATUS_FIELD_ID` (a `SINGLE_SELECT` field).

## Code

```js
import { createClient } from '@mta/github-projects';

const client = createClient({ token: process.env.GITHUB_TOKEN });
const { PROJECT_ID, ITEM_ID, STATUS_FIELD_ID } = process.env;

await client.values.set(PROJECT_ID, ITEM_ID, STATUS_FIELD_ID, 'Done');

// Verify
const fv = await client.values.get(ITEM_ID, STATUS_FIELD_ID);
console.log(fv.value);
```

## Expected outcome

```
{ optionId: 'f75ad846', optionName: 'Done', color: 'GREEN' }
```

## Notes

- Passing an option **id** (string starting with uppercase letters then `_`) skips the lookup.
- Unknown names throw `FieldOptionNotFoundError` with `available` populated for friendly error messages:
  ```
  err.available  // ['Todo', 'In Progress', 'Done']
  ```
- Field schemas are cached per `client` instance — the second `set` call against the same `fieldId` skips the round-trip.
