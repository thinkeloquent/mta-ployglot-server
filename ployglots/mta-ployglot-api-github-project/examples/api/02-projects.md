# API Example: client.projects

## Goal

CRUD for top-level `ProjectV2` records: read by org/user + number, read by node id, list, create, update fields, close/reopen, delete.

## Signature / Contract

```ts
client.projects = {
  get({ owner: string, number: number }): Promise<Project>,
  getById(id: string): Promise<Project>,
  list({ owner: string, scope: 'org' | 'user' }): AsyncIterable<Project>,
  create({ ownerId: string, title: string, repositoryId?: string }): Promise<Project>,
  update(id: string, fields: Partial<{ title, shortDescription, readme, public, closed }>): Promise<Project>,
  close(id: string): Promise<Project>,    // sets closed: true
  reopen(id: string): Promise<Project>,   // sets closed: false
  delete(id: string): Promise<{ id: string }>,  // PERMANENT
}
```

## Project shape

```ts
type Project = {
  id: string;            // PVT_kw...
  number: number;
  title: string;
  url: string;
  closed: boolean;
  public: boolean;
  shortDescription: string | null;
  readme: string | null;
  owner: { __typename: 'Organization' | 'User'; login: string };
  createdAt: string;     // ISO
  updatedAt: string;
}
```

## Errors / Failure modes

| Condition                                | Surface                                  |
| ---------------------------------------- | ---------------------------------------- |
| `get`: project not found                 | `GitHubGraphQLError` (errors[].type='NOT_FOUND') |
| `update` with empty `fields`             | `ValidationError`                        |
| `create` missing `ownerId` or `title`    | `Error('ownerId and title required')`    |
| `list` invalid `scope`                   | `Error("scope must be 'org' or 'user'")` |

## Example

```js
const proj = await client.projects.create({
  ownerId: 'O_kgDOABCDE',
  title: 'Q3 Roadmap',
});

await client.projects.update(proj.id, { shortDescription: 'roll-up' });

for await (const p of client.projects.list({ owner: 'acme', scope: 'org' })) {
  console.log(p.number, p.title);
}

await client.projects.close(proj.id);   // soft delete (recoverable)
// await client.projects.delete(proj.id);  // permanent
```

## Notes

- "Archive" in product UX → `close(id)`. There is no separate archive mutation at the project level.
- `delete` is irreversible; prefer `close` unless you really mean it.
- `list` paginates 100/page via the F02 `paginate` helper.
