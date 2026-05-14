# API Example: client.access

## Goal

Manage project-level access: list collaborators (users + teams) with their roles, add/update roles, set the org-member default base role, remove access.

## Signature / Contract

```ts
type Role = 'NONE' | 'READ' | 'WRITE' | 'ADMIN';
type Type = 'USER' | 'TEAM';

client.access = {
  listCollaborators(projectId: string): Promise<Collaborator[]>,
  getBaseRole(projectId: string): Promise<Role | null>,
  addCollaborator(projectId: string, c: { login: string, type: Type, role: Role }): Promise<Collaborator[]>,
  updateCollaboratorRole(projectId: string, c: { login: string, type: Type, role: Role }): Promise<Collaborator[]>,
  removeCollaborator(projectId: string, c: { login: string, type: Type }): Promise<Collaborator[]>,
  setBaseRole(projectId: string, role: Role): Promise<Role>,
}
```

## Collaborator shape

```ts
type Collaborator = {
  login: string;     // 'octocat' for USER, 'acme/platform' for TEAM
  type: 'USER' | 'TEAM';
  role: Role;
  id: string;        // node id of the User or Team
}
```

## Errors / Failure modes

| Condition                                              | Surface                                  |
| ------------------------------------------------------ | ---------------------------------------- |
| Role outside `NONE/READ/WRITE/ADMIN`                   | `ValidationError`                        |
| Team login not in `org/slug` form                      | `Error("team login must be 'org/slug', got '<x>'")` |
| User/team not found                                    | `Error('<TYPE> <login> not found')`      |
| `getBaseRole` on a host that does not expose the field | `null` returned (no throw)               |

## Example

```js
await client.access.addCollaborator(projectId, { login: 'octocat',       type: 'USER', role: 'READ' });
await client.access.addCollaborator(projectId, { login: 'acme/platform', type: 'TEAM', role: 'ADMIN' });

const list = await client.access.listCollaborators(projectId);
for (const c of list) console.log(`${c.type} ${c.login} = ${c.role}`);

await client.access.updateCollaboratorRole(projectId, { login: 'octocat', type: 'USER', role: 'WRITE' });
await client.access.removeCollaborator(projectId,    { login: 'octocat', type: 'USER' });

await client.access.setBaseRole(projectId, 'WRITE');
```

## Notes

- The four named methods all dispatch to the same `updateProjectV2Collaborators` mutation under the hood — `removeCollaborator` is a `_setRole` with `role: 'NONE'`. The split is for clarity, not API distinction.
- Actor-id resolution is cached per `client` instance — repeated operations against the same login are cheap.
- This module manages **project access**, not repository access. Underlying issue/PR visibility still depends on repo permissions.
