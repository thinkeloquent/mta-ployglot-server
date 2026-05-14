import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRelationships } from '../../src/resources/relationships.mjs';

function makeStubClient(handlers) {
  const calls = { graphql: [], rest: [] };
  return {
    calls,
    async graphql(q, v) { calls.graphql.push({ q, v }); return await handlers.graphql(q, v, calls.graphql.length); },
    async rest(method, path, body) { calls.rest.push({ method, path, body }); return await handlers.rest(method, path, body, calls.rest.length); },
  };
}

const fakeFields = {
  list: async function* () {},
  async create() { return { id: 'F_BB' }; },
  async get() { return { id: 'F_BB', name: 'Blocked by', dataType: 'TEXT' }; },
};

const fakeItems = { list: async function* () {} };

const fakeValues = {
  store: new Map(),
  async get(itemId, fieldId) {
    const v = this.store.get(`${itemId}:${fieldId}`);
    return v ? { fieldId, fieldName: 'Blocked by', value: v } : null;
  },
  async set(_p, itemId, fieldId, value) {
    this.store.set(`${itemId}:${fieldId}`, value);
    return { id: itemId };
  },
};

test('subIssues.list GETs the right path', async () => {
  const c = makeStubClient({
    graphql: () => ({ node: { id: 'P', databaseId: 1, number: 7, repository: { name: 'r', owner: { login: 'o' } } } }),
    rest: () => ({}),
  });
  const r = makeRelationships(c, { fields: fakeFields, items: fakeItems, values: fakeValues });
  await r.subIssues.list('P_NODE');
  assert.equal(c.calls.rest[0].path, '/repos/o/r/issues/7/sub_issues');
});

test('subIssues.add POSTs sub_issue_id', async () => {
  let n = 0;
  const c = makeStubClient({
    graphql: () => {
      n++;
      if (n === 1) return { node: { id: 'P', databaseId: 1, number: 7, repository: { name: 'r', owner: { login: 'o' } } } };
      return { node: { id: 'C', databaseId: 99, number: 12, repository: { name: 'r', owner: { login: 'o' } } } };
    },
    rest: () => ({}),
  });
  const r = makeRelationships(c, { fields: fakeFields, items: fakeItems, values: fakeValues });
  await r.subIssues.add('P_NODE', 'C_NODE');
  assert.equal(c.calls.rest[0].method, 'POST');
  assert.deepEqual(c.calls.rest[0].body, { sub_issue_id: 99 });
});

test('subIssues.remove DELETEs sub_issue', async () => {
  let n = 0;
  const c = makeStubClient({
    graphql: () => {
      n++;
      const node = { id: 'X', databaseId: n, number: 5, repository: { name: 'r', owner: { login: 'o' } } };
      return { node };
    },
    rest: () => ({}),
  });
  const r = makeRelationships(c, { fields: fakeFields, items: fakeItems, values: fakeValues });
  await r.subIssues.remove('P_NODE', 'C_NODE');
  assert.equal(c.calls.rest[0].method, 'DELETE');
  assert.match(c.calls.rest[0].path, /\/sub_issue$/);
});

test('subIssues.reorder PATCHes sub_issue_ids in order', async () => {
  let n = 0;
  const c = makeStubClient({
    graphql: () => {
      n++;
      // first call → parent, then 3 children
      const node = { id: 'X', databaseId: n === 1 ? 100 : (10 + n - 1), number: n, repository: { name: 'r', owner: { login: 'o' } } };
      return { node };
    },
    rest: () => ({}),
  });
  const r = makeRelationships(c, { fields: fakeFields, items: fakeItems, values: fakeValues });
  await r.subIssues.reorder('P', ['A', 'B', 'C']);
  assert.equal(c.calls.rest[0].method, 'PATCH');
  assert.deepEqual(c.calls.rest[0].body.sub_issue_ids, [11, 12, 13]);
});

test('subIssues.reparent without parent only POSTs add', async () => {
  let n = 0;
  const c = makeStubClient({
    graphql: () => {
      n++;
      return { node: { id: 'X', databaseId: n, number: n, repository: { name: 'r', owner: { login: 'o' } } } };
    },
    rest: (method) => method === 'GET' ? { parent: null } : ({}),
  });
  const r = makeRelationships(c, { fields: fakeFields, items: fakeItems, values: fakeValues });
  await r.subIssues.reparent('CHILD', 'NEWPARENT');
  const methods = c.calls.rest.map(x => x.method);
  assert.deepEqual(methods, ['GET', 'POST']);
});

test('subIssues.reparent with parent DELETEs old then POSTs new', async () => {
  let n = 0;
  const c = makeStubClient({
    graphql: () => {
      n++;
      return { node: { id: 'X', databaseId: n, number: n, repository: { name: 'r', owner: { login: 'o' } } } };
    },
    rest: (method) => method === 'GET' ? { parent: { repository: { name: 'r', owner: { login: 'o' } }, number: 99 } } : ({}),
  });
  const r = makeRelationships(c, { fields: fakeFields, items: fakeItems, values: fakeValues });
  await r.subIssues.reparent('CHILD', 'NEWPARENT');
  const methods = c.calls.rest.map(x => x.method);
  assert.deepEqual(methods, ['GET', 'DELETE', 'POST']);
});

test('crossRepo.link appends body line by default', async () => {
  const numbers = { SRC: 1, TGT: 2 };
  const c = makeStubClient({
    graphql: (q, v) => {
      const key = v.id;
      return { node: { id: key, databaseId: numbers[key], number: numbers[key], repository: { name: 'r', owner: { login: 'o' } } } };
    },
    rest: (method) => method === 'GET' ? { body: 'existing' } : { id: 555 },
  });
  const r = makeRelationships(c, { fields: fakeFields, items: fakeItems, values: fakeValues });
  const out = await r.crossRepo.link('SRC', 'TGT');
  assert.equal(out.mode, 'body');
  const patchCall = c.calls.rest.find(x => x.method === 'PATCH');
  assert.match(patchCall.body.body, /o\/r#2$/);
});

test('crossRepo.link with keyword adds prefix', async () => {
  let n = 0;
  const c = makeStubClient({
    graphql: () => { n++; return { node: { id: 'X', databaseId: n, number: 42, repository: { name: 'api', owner: { login: 'acme' } } } }; },
    rest: (method) => method === 'GET' ? { body: '' } : ({}),
  });
  const r = makeRelationships(c, { fields: fakeFields, items: fakeItems, values: fakeValues });
  await r.crossRepo.link('SRC', 'TGT', { keyword: 'Resolves' });
  const patch = c.calls.rest.find(x => x.method === 'PATCH');
  assert.match(patch.body.body, /Resolves acme\/api#42/);
});

test('crossRepo.link comment mode posts comment, returns id', async () => {
  let n = 0;
  const c = makeStubClient({
    graphql: () => { n++; return { node: { id: 'X', databaseId: n, number: 42, repository: { name: 'api', owner: { login: 'acme' } } } }; },
    rest: (method) => method === 'POST' ? { id: 999 } : ({}),
  });
  const r = makeRelationships(c, { fields: fakeFields, items: fakeItems, values: fakeValues });
  const out = await r.crossRepo.link('SRC', 'TGT', { mode: 'comment' });
  assert.deepEqual(out, { mode: 'comment', commentId: 999 });
});

test('crossRepo.unlink strips matching line from body', async () => {
  let n = 0;
  const c = makeStubClient({
    graphql: () => { n++; return { node: { id: 'X', databaseId: n, number: 42, repository: { name: 'api', owner: { login: 'acme' } } } }; },
    rest: (method) => method === 'GET' ? { body: 'first\nacme/api#42\nlast' } : ({}),
  });
  const r = makeRelationships(c, { fields: fakeFields, items: fakeItems, values: fakeValues });
  await r.crossRepo.unlink('SRC', 'TGT');
  const patch = c.calls.rest.find(x => x.method === 'PATCH');
  assert.equal(patch.body.body, 'first\nlast');
});

test('dependencies add/remove/list round-trip', async () => {
  fakeValues.store.clear();
  const numbers = { B1: 1, B2: 2 };
  const c = makeStubClient({
    graphql: (q, v) => {
      const key = v.id;
      return { node: { id: key, databaseId: numbers[key], number: numbers[key], repository: { name: 'r', owner: { login: 'o' } } } };
    },
    rest: () => ({}),
  });
  const r = makeRelationships(c, { fields: fakeFields, items: fakeItems, values: fakeValues });
  await r.dependencies.add('P', 'I1', 'B1');
  await r.dependencies.add('P', 'I1', 'B2');
  assert.deepEqual(await r.dependencies.list('P', 'I1'), ['o/r#1', 'o/r#2']);
  await r.dependencies.remove('P', 'I1', 'B1');
  assert.deepEqual(await r.dependencies.list('P', 'I1'), ['o/r#2']);
});

test('dependencies.list empty returns []', async () => {
  fakeValues.store.clear();
  const c = makeStubClient({ graphql: () => ({}), rest: () => ({}) });
  const r = makeRelationships(c, { fields: fakeFields, items: fakeItems, values: fakeValues });
  assert.deepEqual(await r.dependencies.list('P', 'I_X'), []);
});

test('dependencies.graph builds nodes + edges', async () => {
  fakeValues.store.clear();
  fakeValues.store.set(`I1:F_BB`, 'o/r#5');     // I1 blocked by I2 (in project)
  fakeValues.store.set(`I3:F_BB`, 'o/r#999');   // I3 blocked by external
  const items = {
    async *list() {
      yield { id: 'I1', content: { url: 'https://github.com/o/r/issues/1' }, fieldValues: [{ fieldId: 'F_BB', fieldName: 'Blocked by', value: 'o/r#5' }] };
      yield { id: 'I2', content: { url: 'https://github.com/o/r/issues/5' }, fieldValues: [] };
      yield { id: 'I3', content: { url: 'https://github.com/o/r/issues/3' }, fieldValues: [{ fieldId: 'F_BB', fieldName: 'Blocked by', value: 'o/r#999' }] };
    },
  };
  const c = makeStubClient({ graphql: () => ({}), rest: () => ({}) });
  const r = makeRelationships(c, { fields: fakeFields, items, values: fakeValues });
  const g = await r.dependencies.graph('P');
  assert.equal(g.nodes.length, 3);
  assert.equal(g.edges.length, 2);
  const inProject = g.edges.find(e => e.fromRef === 'o/r#5');
  assert.equal(inProject.from, 'I2');
  const external = g.edges.find(e => e.fromRef === 'o/r#999');
  assert.equal(external.from, null);
});
