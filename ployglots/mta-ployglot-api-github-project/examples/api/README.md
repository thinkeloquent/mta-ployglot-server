# API Examples

The public function/method contract of `@mta/github-projects`. This is the surface consumers depend on; the implementation may evolve, but the shapes here are the stable promise.

## Surface kind

Synchronous JavaScript factory + namespaced async methods. Constructed once via `createClient(config)`; method calls return Promises that resolve to plain JS objects or throw a `GitHubError` subclass.

## Construction

```js
import { createClient } from '@mta/github-projects';
const client = createClient({ token, host?, proxy?, retry?, fetch? });
```

## Entries

| #   | Entry                                                              | Description                                                  |
| --- | ------------------------------------------------------------------ | ------------------------------------------------------------ |
| 01  | [createClient](01-create-client.md)                                | Factory; auth, host, proxy, retry config.                    |
| 02  | [client.projects](02-projects.md)                                  | Project CRUD: get, getById, list, create, update, close, reopen, delete. |
| 03  | [client.fields](03-fields.md)                                      | Field schema CRUD with built-in field guard.                 |
| 04  | [client.items](04-items.md)                                        | Items lifecycle: add, draft CRUD, list, get, archive, delete. |
| 05  | [client.values](05-values.md)                                      | Per-item field values: get, list, set, clear, find.          |
| 06  | [client.views](06-views.md)                                        | Read views; partial update; unsupported-op stubs.            |
| 07  | [client.access](07-access.md)                                      | Collaborator + base-role CRUD.                               |
| 08  | [client.relations](08-relations.md)                                | Sub-issues, cross-repo links, dependency graph.              |
| 09  | [client.attachments](09-attachments.md)                            | List/attach/replace/delete markdown attachment refs.         |
| 10  | [client.bulk](10-bulk.md)                                          | Batched ops with concurrency + token-bucket throttle.        |
| 11  | [Errors](11-errors.md)                                             | The `GitHubError` hierarchy and stable `.code` values.       |

## Conventions

- All async methods return Promises. Failures throw a `GitHubError` subclass — never a plain `Error`.
- Async iterators (`*list()`) follow GraphQL `pageInfo.endCursor` until `hasNextPage: false`.
- Inputs accept `{owner, repo, number}` *or* node-id strings where both make sense.
- Built-in fields (`Title`, `Status`, `Assignees`, …) are read-everywhere but `create`/`update`/`delete` reject them with `BuiltInFieldError`.
