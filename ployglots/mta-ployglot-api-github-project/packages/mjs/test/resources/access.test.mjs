import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeAccess } from '../../src/resources/access.mjs';

function stub(handler) {
  const calls = [];
  return { calls, async graphql(q, v) { calls.push({ q, v }); return await handler(q, v, calls.length); } };
}

test('listCollaborators returns shaped users + teams', async () => {
  const c = stub(() => ({ node: { collaborators: { nodes: [
    { role: 'WRITE', actor: { __typename: 'User', id: 'U1', login: 'rob' } },
    { role: 'ADMIN', actor: { __typename: 'Team', id: 'T1', slug: 'plat', combinedSlug: 'acme/plat' } },
  ], pageInfo: { hasNextPage: false } } } }));
  const a = makeAccess(c);
  const out = await a.listCollaborators('P');
  assert.deepEqual(out.map(x => x.type), ['USER', 'TEAM']);
  assert.equal(out[1].login, 'acme/plat');
});

test('getBaseRole returns null when not exposed', async () => {
  const c = stub(() => ({ node: { id: 'P' } }));
  const a = makeAccess(c);
  assert.equal(await a.getBaseRole('P'), null);
});

test('addCollaborator USER builds {userId, role}', async () => {
  let n = 0;
  const c = stub(() => {
    n++;
    if (n === 1) return { user: { id: 'U1' } };
    return { updateProjectV2Collaborators: { collaborators: { nodes: [] } } };
  });
  const a = makeAccess(c);
  await a.addCollaborator('P', { login: 'rob', type: 'USER', role: 'READ' });
  assert.deepEqual(c.calls[1].v.input.collaborators[0], { userId: 'U1', role: 'READ' });
});

test('addCollaborator TEAM builds {teamId, role}', async () => {
  let n = 0;
  const c = stub(() => {
    n++;
    if (n === 1) return { organization: { team: { id: 'T1' } } };
    return { updateProjectV2Collaborators: { collaborators: { nodes: [] } } };
  });
  const a = makeAccess(c);
  await a.addCollaborator('P', { login: 'acme/plat', type: 'TEAM', role: 'WRITE' });
  assert.deepEqual(c.calls[1].v.input.collaborators[0], { teamId: 'T1', role: 'WRITE' });
});

test('invalid role throws ValidationError', async () => {
  const c = stub(() => ({}));
  const a = makeAccess(c);
  await assert.rejects(a.addCollaborator('P', { login: 'rob', type: 'USER', role: 'GOD' }),
    (err) => err.name === 'ValidationError');
});

test('removeCollaborator passes role NONE', async () => {
  let n = 0;
  const c = stub(() => {
    n++;
    if (n === 1) return { user: { id: 'U1' } };
    return { updateProjectV2Collaborators: { collaborators: { nodes: [] } } };
  });
  const a = makeAccess(c);
  await a.removeCollaborator('P', { login: 'rob', type: 'USER' });
  assert.equal(c.calls[1].v.input.collaborators[0].role, 'NONE');
});

test('setBaseRole posts UPDATE_BASE_ROLE', async () => {
  const c = stub(() => ({ updateProjectV2: { projectV2: { id: 'P' } } }));
  const a = makeAccess(c);
  const out = await a.setBaseRole('P', 'WRITE');
  assert.equal(out, 'WRITE');
  assert.deepEqual(c.calls[0].v, { projectId: 'P', role: 'WRITE' });
});

test('actor cache prevents duplicate resolution', async () => {
  let resolveCount = 0;
  const c = stub((q) => {
    if (q.includes('user(login')) { resolveCount++; return { user: { id: 'U1' } }; }
    return { updateProjectV2Collaborators: { collaborators: { nodes: [] } } };
  });
  const a = makeAccess(c);
  await a.addCollaborator('P', { login: 'rob', type: 'USER', role: 'READ' });
  await a.updateCollaboratorRole('P', { login: 'rob', type: 'USER', role: 'WRITE' });
  assert.equal(resolveCount, 1);
});

test('malformed team login throws', async () => {
  const c = stub(() => ({}));
  const a = makeAccess(c);
  await assert.rejects(a.addCollaborator('P', { login: 'just-a-team', type: 'TEAM', role: 'READ' }),
    /team login must be 'org\/slug'/);
});
