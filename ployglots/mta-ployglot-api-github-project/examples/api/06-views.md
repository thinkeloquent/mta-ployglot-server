# API Example: client.views

## Goal

Read project views (table / board / roadmap), update the subset of attributes GitHub exposes via mutation (`name`, `filter`), and fail loudly on operations the GraphQL surface does not expose.

## Signature / Contract

```ts
client.views = {
  list(projectId: string): AsyncIterable<View>,
  get(viewId: string): Promise<View>,
  update(viewId: string, fields: { name?: string, filter?: string }): Promise<View>,
  // The following exist but THROW — GraphQL does not expose them:
  create(...): never,        // throws ViewOperationUnsupportedError
  delete(...): never,        // throws ViewOperationUnsupportedError
  changeLayout(...): never,  // throws ViewOperationUnsupportedError
}
```

## View shape

```ts
type View = {
  id: string;
  name: string;
  number: number;
  layout: 'table' | 'board' | 'roadmap';     // friendly form (not GraphQL enum)
  filter: string;
  groupBy: Array<{ id, name }>;
  sortBy:  Array<{ fieldId, fieldName, direction: 'ASC'|'DESC' }>;
  visibleFields: Array<{ id, name }>;
}
```

## Errors / Failure modes

| Condition                                                                   | Surface                                                         |
| --------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `update` with any key other than `name` / `filter` (e.g. `sortBy`, `groupBy`) | `ViewOperationUnsupportedError` (`code: 'VIEW_MUTATION_UNAVAILABLE'`); `.unsupported` lists rejected keys; `.docLink` set |
| `create` / `delete` / `changeLayout`                                        | `ViewOperationUnsupportedError`; `.op` carries the verb         |

## Example

```js
for await (const v of client.views.list(projectId)) {
  console.log(v.layout, v.name, v.filter);
}

await client.views.update('PVTV_xyz', {
  name: 'Open + High Priority',
  filter: 'is:open priority:High',
});

try {
  await client.views.update('PVTV_xyz', { sortBy: [/* ... */] });
} catch (err) {
  // err.name === 'ViewOperationUnsupportedError'
  // err.code === 'VIEW_MUTATION_UNAVAILABLE'
  // err.docLink → docs URL
  // err.unsupported === ['sortBy']
}
```

## Notes

- Layout enum mapping is bidirectional via `views-layout.mjs` (`TABLE_LAYOUT ↔ 'table'`).
- Net-new views must be created in the GitHub UI; the API can only manage existing ones.
- The unsupported stubs intentionally throw rather than silently no-op so consumers don't paper over a UI-only operation.
