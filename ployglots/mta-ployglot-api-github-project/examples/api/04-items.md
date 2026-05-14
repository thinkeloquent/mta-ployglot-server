# API Example: client.items

## Goal

Manage the work units of a project: add existing issues/PRs, create/update/convert/delete drafts, list/get with eager-loaded field values, archive, remove.

## Signature / Contract

```ts
client.items = {
  add(projectId: string, contentId: string): Promise<Item>,           // existing Issue/PR
  createDraft(projectId: string, { title: string, body?, assigneeIds?: string[] }): Promise<Item>,
  updateDraft(itemId: string, { title?, body? }): Promise<{ id, title, body }>,
  deleteDraft(itemId: string, projectId: string): Promise<{ deletedItemId: string }>,
  convertDraft(itemId: string, repositoryId: string): Promise<Item>,
  list(projectId: string, opts?: { fields?: string[] }): AsyncIterable<Item>,
  get(itemId: string): Promise<Item>,
  archive(projectId: string, itemId: string): Promise<Item>,
  unarchive(projectId: string, itemId: string): Promise<Item>,
  delete(projectId: string, itemId: string): Promise<{ deletedItemId: string }>,
}
```

## Item shape

```ts
type Item = {
  id: string;                   // PVTI_...
  type: 'ISSUE' | 'PULL_REQUEST' | 'DRAFT_ISSUE';
  isArchived: boolean;
  content: {
    __typename: 'Issue' | 'PullRequest' | 'DraftIssue';
    id?: string; number?: number; title?: string; url?: string; state?: string; body?: string;
  };
  fieldValues: Array<{ fieldId, fieldName, value: unknown }>;
}
```

## Errors / Failure modes

| Condition                                              | Surface                                  |
| ------------------------------------------------------ | ---------------------------------------- |
| `createDraft` without `title`                          | `Error('title is required')`             |
| `updateDraft` / `deleteDraft` / `convertDraft` on non-draft | `NotADraftError` (`code: 'NOT_A_DRAFT'`) |
| `convertDraft` without `repositoryId`                  | `Error('repositoryId required')`         |
| `get` not found                                        | `Error('item <id> not found')`           |

## Example

```js
// Add an existing issue
const item = await client.items.add(projectId, 'I_kwDOXYZ123');

// Create a draft
const draft = await client.items.createDraft(projectId, { title: 'Spike: cache layer', body: 'TBD' });

// Convert it to a real issue once it's ready
await client.items.convertDraft(draft.id, 'R_kgDORepo');

// Read with field-name filtering
for await (const it of client.items.list(projectId, { fields: ['Status'] })) {
  console.log(it.id, it.fieldValues);
}

// Archive (reversible) vs delete (removes from project, NOT from repo)
await client.items.archive(projectId, item.id);
await client.items.delete(projectId, item.id);
```

## Notes

- `delete` removes the item from the project; the underlying Issue/PR is preserved.
- `deleteDraft` permanently deletes a draft; only allowed on `DRAFT_ISSUE`.
- `list`'s `fields` option is a client-side filter on the per-item `fieldValues` array — it does not narrow which items are returned.
- Reordering items across status columns is a **field value change** on the `Status` field — see `client.values.set` or `client.bulk.moveStatus`.
