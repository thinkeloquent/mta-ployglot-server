import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeViews } from '../../src/resources/views.mjs';

function stub(handler) {
  const calls = [];
  return { calls, async graphql(q, v) { calls.push({ q, v }); return await handler(q, v, calls.length); } };
}

const sampleNode = {
  id: 'V1', name: 'Default', number: 1, layout: 'TABLE_LAYOUT', filter: 'is:open',
  groupByFields: { nodes: [{ id: 'F1', name: 'Status' }] },
  sortByFields: { nodes: [{ field: { id: 'F2', name: 'Priority' }, direction: 'ASC' }] },
  fields: { nodes: [{ id: 'F1', name: 'Status' }, { id: 'F3', name: 'Title' }] },
};

test('list yields shaped views with friendly layout', async () => {
  const c = stub(() => ({ node: { views: { nodes: [sampleNode], pageInfo: { hasNextPage: false } } } }));
  const v = makeViews(c);
  const out = [];
  for await (const x of v.list('P')) out.push(x);
  assert.equal(out[0].layout, 'table');
  assert.equal(out[0].sortBy[0].fieldName, 'Priority');
});

test('get returns single shaped view', async () => {
  const c = stub(() => ({ node: sampleNode }));
  const v = makeViews(c);
  const out = await v.get('V1');
  assert.equal(out.layout, 'table');
});

test('update with name+filter posts mutation', async () => {
  const c = stub(() => ({ updateProjectV2View: { projectV2View: { ...sampleNode, name: 'X' } } }));
  const v = makeViews(c);
  const out = await v.update('V1', { name: 'X', filter: 'is:open' });
  assert.equal(out.name, 'X');
  assert.deepEqual(c.calls[0].v.input, { viewId: 'V1', name: 'X', filter: 'is:open' });
});

test('update with sortBy throws ViewOperationUnsupportedError', async () => {
  const c = stub(() => ({}));
  const v = makeViews(c);
  await assert.rejects(v.update('V1', { sortBy: [] }), (err) =>
    err.name === 'ViewOperationUnsupportedError'
    && err.code === 'VIEW_MUTATION_UNAVAILABLE'
    && typeof err.docLink === 'string');
});

test('create/delete/changeLayout throw unsupported', async () => {
  const v = makeViews(stub(() => ({})));
  for (const op of ['create', 'delete', 'changeLayout']) {
    assert.throws(() => v[op](), (err) =>
      err.name === 'ViewOperationUnsupportedError' && err.code === 'VIEW_MUTATION_UNAVAILABLE' && err.op === op);
  }
});
