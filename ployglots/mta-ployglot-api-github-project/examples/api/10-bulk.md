# API Example: client.bulk

## Goal

Compose per-resource operations into batched flows with bounded concurrency, partial-failure reporting, and a token-bucket throttle to stay clear of secondary rate limits.

## Signature / Contract

```ts
type BulkResult<T> = { ok: T[], failed: Array<{ input: unknown, error: Error }> };

type BulkOpts = {
  concurrency?: number;                       // default 5
  bucket?: { take(n?: number): Promise<void> };  // default: 80 mutations / 60s
};

client.bulk = {
  updateItems(projectId: string, updates: Array<{
    itemId: string;
    fieldUpdates: Record<string, unknown>;    // key = fieldId (PVTF_…) or field name
  }>, opts?: BulkOpts): Promise<BulkResult<unknown[]>>,
  assignField(projectId: string, { fieldId: string, value: unknown }, itemIds: string[], opts?: BulkOpts): Promise<BulkResult<unknown>>,
  moveStatus(projectId: string, { statusFieldId: string, optionId: string }, itemIds: string[], opts?: BulkOpts): Promise<BulkResult<unknown>>,
  bulkAdd(projectId: string, contentIds: string[], opts?: BulkOpts): Promise<BulkResult<unknown>>,
  validateDependencyGraph(projectId: string): Promise<{ cycles: string[][] }>,
}
```

## Errors / Failure modes

| Condition                  | Surface                                                                |
| -------------------------- | ---------------------------------------------------------------------- |
| Per-input failure          | Captured into `result.failed[]` — the call **does not throw**.         |
| Concurrency `< 1` or non-int | `Error('max must be positive integer')` from `pLimit`.               |
| Field name not in project (in `updateItems`) | Per-item `Error('field "<name>" not found in project <id>')` → `result.failed[]`. |

## Example: bulk update + partial failure

```js
const updates = items.map(it => ({
  itemId: it.id,
  fieldUpdates: { 'Status': 'Done', 'Priority': 'PVTF_priority_id_or_name' },
}));

const result = await client.bulk.updateItems(projectId, updates, { concurrency: 5 });
console.log(`ok: ${result.ok.length}, failed: ${result.failed.length}`);
for (const f of result.failed) console.error(f.input.itemId, f.error.message);
```

## Example: cycle detection

```js
const { cycles } = await client.bulk.validateDependencyGraph(projectId);
if (cycles.length === 0) {
  console.log('graph is acyclic ✓');
} else {
  for (const cycle of cycles) console.warn('cycle:', cycle.join(' → '));
}
```

## Notes

- `BulkResult` is intentionally non-throwing because partial success is the common case for batch operations.
- Field keys in `updateItems.fieldUpdates` accept either a `PVTF_...` id (used directly) or a field name (resolved via `values.resolveFieldIdByName`, cached per `client`).
- Default token bucket = 80 mutations / 60s. Override with a stricter bucket for larger batches; GitHub's documented secondary limit is ~100/minute.
- `moveStatus` is a thin wrapper over `assignField` for the `Status` field — call sites read more clearly when the intent is "kanban move."
