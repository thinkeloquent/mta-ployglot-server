import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeProjects } from '../../src/resources/projects.mjs';

function stubClient(fn) {
  const calls = [];
  const client = {
    async graphql(query, vars) {
      calls.push({ query, vars });
      return await fn(query, vars, calls.length);
    },
  };
  return { client, calls };
}

test('get returns org branch when present', async () => {
  const { client } = stubClient(() => ({ organization: { projectV2: { id: 'P1', number: 1, title: 'X' } }, user: null }));
  const p = makeProjects(client);
  assert.deepEqual(await p.get({ owner: 'acme', number: 1 }), { id: 'P1', number: 1, title: 'X' });
});

test('get returns user branch when org null', async () => {
  const { client } = stubClient(() => ({ organization: null, user: { projectV2: { id: 'P2' } } }));
  const p = makeProjects(client);
  assert.deepEqual(await p.get({ owner: 'rob', number: 2 }), { id: 'P2' });
});

test('get throws when both null', async () => {
  const { client } = stubClient(() => ({ organization: null, user: null }));
  const p = makeProjects(client);
  await assert.rejects(p.get({ owner: 'x', number: 99 }), (err) => err.name === 'GitHubGraphQLError');
});

test('getById returns node', async () => {
  const { client } = stubClient(() => ({ node: { id: 'PVT_kw1' } }));
  const p = makeProjects(client);
  assert.deepEqual(await p.getById('PVT_kw1'), { id: 'PVT_kw1' });
});

test('getById throws when missing', async () => {
  const { client } = stubClient(() => ({ node: null }));
  const p = makeProjects(client);
  await assert.rejects(p.getById('x'), (err) => err.name === 'GitHubGraphQLError');
});

test('list paginates org scope', async () => {
  const pages = [
    { organization: { projectsV2: { nodes: [{ id: 1 }, { id: 2 }], pageInfo: { hasNextPage: true, endCursor: 'a' } } } },
    { organization: { projectsV2: { nodes: [{ id: 3 }], pageInfo: { hasNextPage: false } } } },
  ];
  let i = 0;
  const { client } = stubClient(() => pages[i++]);
  const p = makeProjects(client);
  const out = [];
  for await (const x of p.list({ owner: 'acme', scope: 'org' })) out.push(x);
  assert.deepEqual(out, [{ id: 1 }, { id: 2 }, { id: 3 }]);
});

test('list invalid scope throws', () => {
  const { client } = stubClient(() => ({}));
  const p = makeProjects(client);
  assert.throws(() => p.list({ owner: 'a', scope: 'bogus' }), /scope must be/);
});

test('list empty org yields nothing', async () => {
  const { client } = stubClient(() => ({ organization: { projectsV2: { nodes: [], pageInfo: { hasNextPage: false } } } }));
  const p = makeProjects(client);
  const out = [];
  for await (const x of p.list({ owner: 'acme', scope: 'org' })) out.push(x);
  assert.deepEqual(out, []);
});

test('create requires ownerId and title', async () => {
  const { client } = stubClient(() => ({}));
  const p = makeProjects(client);
  await assert.rejects(p.create({ title: 'x' }), /ownerId and title required/);
  await assert.rejects(p.create({ ownerId: 'x' }), /ownerId and title required/);
});

test('create returns project', async () => {
  const { client, calls } = stubClient(() => ({ createProjectV2: { projectV2: { id: 'P1', title: 'X' } } }));
  const p = makeProjects(client);
  const out = await p.create({ ownerId: 'O1', title: 'X' });
  assert.deepEqual(out, { id: 'P1', title: 'X' });
  assert.deepEqual(calls[0].vars.input, { ownerId: 'O1', title: 'X' });
});

test('create includes repositoryId only when provided', async () => {
  const { client, calls } = stubClient(() => ({ createProjectV2: { projectV2: { id: 'P' } } }));
  const p = makeProjects(client);
  await p.create({ ownerId: 'O', title: 'T', repositoryId: 'R' });
  assert.deepEqual(calls[0].vars.input, { ownerId: 'O', title: 'T', repositoryId: 'R' });
});

test('update with empty fields throws', async () => {
  const { client } = stubClient(() => ({}));
  const p = makeProjects(client);
  await assert.rejects(p.update('id', {}), (err) => err.name === 'ValidationError');
});

test('update sends only known fields', async () => {
  const { client, calls } = stubClient(() => ({ updateProjectV2: { projectV2: { id: 'P' } } }));
  const p = makeProjects(client);
  await p.update('P', { title: 'x', readme: 'y', bogus: 'z' });
  assert.deepEqual(calls[0].vars.input, { projectId: 'P', title: 'x', readme: 'y' });
});

test('close sends closed:true', async () => {
  const { client, calls } = stubClient(() => ({ updateProjectV2: { projectV2: { id: 'P' } } }));
  const p = makeProjects(client);
  await p.close('P');
  assert.equal(calls[0].vars.input.closed, true);
});

test('reopen sends closed:false', async () => {
  const { client, calls } = stubClient(() => ({ updateProjectV2: { projectV2: { id: 'P' } } }));
  const p = makeProjects(client);
  await p.reopen('P');
  assert.equal(calls[0].vars.input.closed, false);
});

test('delete returns the deleted id', async () => {
  const { client } = stubClient(() => ({ deleteProjectV2: { projectV2: { id: 'P' } } }));
  const p = makeProjects(client);
  assert.deepEqual(await p.delete('P'), { id: 'P' });
});
