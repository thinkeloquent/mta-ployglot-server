# API Example: client.relations

## Goal

Three sub-namespaces: `subIssues` (REST sub-issue API), `crossRepo` (issue-body / comment references), `dependencies` (`Blocked by` field convention with cycle-aware graph).

## Signature / Contract

```ts
type IssueRef = string | { owner: string, repo: string, number: number };

client.relations = {
  subIssues: {
    list(parent: IssueRef): Promise<unknown[]>,
    add(parent: IssueRef, child: IssueRef): Promise<unknown>,
    remove(parent: IssueRef, child: IssueRef): Promise<unknown>,
    reorder(parent: IssueRef, orderedChildren: IssueRef[]): Promise<unknown>,
    reparent(child: IssueRef, newParent: IssueRef): Promise<unknown>,
  },
  crossRepo: {
    link(source: IssueRef, target: IssueRef, opts?: { keyword?: string, mode?: 'body' | 'comment' }): Promise<{ mode, commentId? }>,
    unlink(source: IssueRef, target: IssueRef, opts?: { commentId?: number }): Promise<unknown>,
  },
  dependencies: {
    add(projectId: string, itemId: string, blockedByItemRef: IssueRef): Promise<unknown>,
    remove(projectId: string, itemId: string, blockedByItemRef: IssueRef): Promise<unknown>,
    list(projectId: string, itemId: string): Promise<string[]>,           // ['acme/api#42', ...]
    graph(projectId: string): Promise<{
      nodes: Array<{ itemId: string, ref: string | null }>,
      edges: Array<{ from: string | null, fromRef: string, to: string }>,
    }>,
  },
}
```

## Errors / Failure modes

| Condition                                       | Surface                                  |
| ----------------------------------------------- | ---------------------------------------- |
| Invalid `IssueRef`                              | `Error('issueRef must be a node id string or { owner, repo, number }')` |
| Sub-issue endpoints unavailable on the host     | `GitHubHTTPError` from REST call         |
| Predicate / mutator throws inside `crossRepo` ops | propagated to caller                   |

## Example

```js
const parent = { owner: 'acme', repo: 'platform', number: 100 };
await client.relations.subIssues.add(parent, 'I_kwDOChild');
await client.relations.subIssues.reorder(parent, [/* refs in desired order */]);

await client.relations.crossRepo.link(
  { owner: 'acme', repo: 'web',     number: 7 },
  { owner: 'acme', repo: 'backend', number: 99 },
  { keyword: 'Resolves' },
);

await client.relations.dependencies.add(projectId, 'PVTI_a', { owner: 'acme', repo: 'api', number: 42 });
const blockers = await client.relations.dependencies.list(projectId, 'PVTI_a');
// → ['acme/api#42']

const graph = await client.relations.dependencies.graph(projectId);
// {
//   nodes: [{ itemId: 'PVTI_a', ref: 'acme/api#1' }, ...],
//   edges: [{ from: 'PVTI_b', fromRef: 'acme/api#42', to: 'PVTI_a' }, ...],
// }
```

## Notes

- `subIssues` writes target the underlying Issue, not the project item. Removing a sub-issue link does **not** remove either issue from the project.
- `dependencies` is a workaround for GitHub's lack of first-class blocks/blocked-by — it stores comma-separated `<owner>/<repo>#<number>` refs in a `Blocked by` text field that the SDK auto-creates on first use.
- For cycle detection on the dependency graph, use `client.bulk.validateDependencyGraph(projectId)`.
