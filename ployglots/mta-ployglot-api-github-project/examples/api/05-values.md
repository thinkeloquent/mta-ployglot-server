# API Example: client.values

## Goal

Read and write per-item field values with type-aware dispatch. One `set` handles all field types; option **names** auto-resolve to ids.

## Signature / Contract

```ts
client.values = {
  get(itemId: string, fieldId: string): Promise<FieldValue | null>,
  list(itemId: string): Promise<FieldValue[]>,
  set(projectId: string, itemId: string, fieldId: string, value: unknown): Promise<{ id, type, isArchived }>,
  clear(projectId: string, itemId: string, fieldId: string): Promise<{ id }>,
  findItemsWithValue(projectId: string, fieldName: string, predicate: (value: unknown) => boolean): Promise<Item[]>,
  resolveFieldIdByName(projectId: string, name: string): Promise<string>,
}
```

## Value dispatch

| Field `dataType` | Accepted `value` shape                                   | Mutation input |
| ---------------- | -------------------------------------------------------- | -------------- |
| `TEXT`           | `string`                                                 | `{ text }`     |
| `NUMBER`         | `number`                                                 | `{ number }`   |
| `DATE`           | `string` matching `YYYY-MM-DD`                           | `{ date }`     |
| `SINGLE_SELECT`  | option **id** (`'OPT_…'`) or option **name** (resolved)  | `{ singleSelectOptionId }` |
| `ITERATION`      | iteration **id** string OR `{ iterationId }`             | `{ iterationId }` |

## Errors / Failure modes

| Condition                                                | Surface                                       |
| -------------------------------------------------------- | --------------------------------------------- |
| `set` on read-only built-in (`Title`, `Linked pull requests`, `Reviewers`, `Repository`) | `FieldNotWritableError` (`code: 'FIELD_NOT_WRITABLE'`) |
| `set` SINGLE_SELECT with name not in options             | `FieldOptionNotFoundError` (`code: 'FIELD_OPTION_NOT_FOUND'`); `.available` lists valid names |
| Wrong JS type for the dataType                           | `ValidationError`                             |
| `resolveFieldIdByName` unknown name                      | `Error('field "<name>" not found in project <id>')` |

## Example

```js
// By id
await client.values.set(projectId, itemId, 'PVTF_status', 'OPT_done');

// By name (one extra fields.get round-trip; cached after)
await client.values.set(projectId, itemId, 'PVTF_status', 'Done');

// Date
await client.values.set(projectId, itemId, 'PVTF_due', '2026-04-30');

// Iteration
await client.values.set(projectId, itemId, 'PVTF_sprint', { iterationId: 'IT_kgDOSpr' });

// Clear back to null
await client.values.clear(projectId, itemId, 'PVTF_due');

// Predicate scan (no server-side filter exists for arbitrary field values)
const overdue = await client.values.findItemsWithValue(projectId, 'Due',
  v => v && v < '2026-04-18');
```

## Notes

- Field schemas are cached per `client` instance; the first `set` against a given `fieldId` does one `fields.get`, subsequent calls reuse it.
- `findItemsWithValue` walks every page of `items.list(projectId)` — O(n) in items. Predicate exceptions propagate to the caller.
- `clear` documents (in JSDoc) that GitHub project workflows can auto-set values on events; workflow management is out of scope for this lib.
