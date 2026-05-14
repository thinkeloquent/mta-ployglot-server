import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeFields } from '../../src/resources/fields.mjs';

function stubClient(handler) {
  const calls = [];
  return {
    calls,
    async graphql(query, vars) {
      calls.push({ query, vars });
      return await handler(query, vars, calls.length);
    },
  };
}

test('list yields annotated fields', async () => {
  const client = stubClient(() => ({
    node: { fields: { nodes: [{ id: 'F1', name: 'Title' }, { id: 'F2', name: 'Custom' }], pageInfo: { hasNextPage: false } } },
  }));
  const f = makeFields(client);
  const out = [];
  for await (const x of f.list('proj')) out.push(x);
  assert.equal(out[0].isBuiltIn, true);
  assert.equal(out[1].isBuiltIn, false);
});

test('get returns annotated single field', async () => {
  const client = stubClient(() => ({ node: { id: 'F1', name: 'Status' } }));
  const f = makeFields(client);
  const out = await f.get('F1');
  assert.equal(out.isBuiltIn, true);
});

test('create TEXT input has only basic fields', async () => {
  const client = stubClient(() => ({ createProjectV2Field: { projectV2Field: { id: 'F', name: 'N', dataType: 'TEXT' } } }));
  const f = makeFields(client);
  await f.create('proj', { name: 'N', dataType: 'TEXT' });
  assert.deepEqual(client.calls[0].vars.input, { projectId: 'proj', name: 'N', dataType: 'TEXT' });
});

test('create SINGLE_SELECT applies default color/description', async () => {
  const client = stubClient(() => ({ createProjectV2Field: { projectV2Field: { id: 'F', name: 'N' } } }));
  const f = makeFields(client);
  await f.create('proj', { name: 'N', dataType: 'SINGLE_SELECT', singleSelectOptions: [{ name: 'A' }] });
  assert.deepEqual(client.calls[0].vars.input.singleSelectOptions, [{ name: 'A', color: 'GRAY', description: '' }]);
});

test('create ITERATION without config throws (no API call)', async () => {
  const client = stubClient(() => ({}));
  const f = makeFields(client);
  await assert.rejects(f.create('proj', { name: 'N', dataType: 'ITERATION' }), /ITERATION requires/);
  assert.equal(client.calls.length, 0);
});

test('update on built-in throws', async () => {
  const client = stubClient(() => ({ node: { id: 'F1', name: 'Title' } }));
  const f = makeFields(client);
  await assert.rejects(f.update('F1', { name: 'NewTitle' }), (err) => err.name === 'BuiltInFieldError');
});

test('update on custom sends fieldId+name', async () => {
  let n = 0;
  const client = stubClient(() => {
    n++;
    if (n === 1) return { node: { id: 'F2', name: 'Custom' } };
    return { updateProjectV2Field: { projectV2Field: { id: 'F2', name: 'Custom2' } } };
  });
  const f = makeFields(client);
  await f.update('F2', { name: 'Custom2' });
  assert.deepEqual(client.calls[1].vars.input, { fieldId: 'F2', name: 'Custom2' });
});

test('delete on built-in throws', async () => {
  const client = stubClient(() => ({ node: { id: 'F1', name: 'Status' } }));
  const f = makeFields(client);
  await assert.rejects(f.delete('F1'), (err) => err.name === 'BuiltInFieldError');
});

test('delete on custom returns id', async () => {
  let n = 0;
  const client = stubClient(() => {
    n++;
    if (n === 1) return { node: { id: 'F2', name: 'Custom' } };
    return { deleteProjectV2Field: { projectV2Field: { id: 'F2' } } };
  });
  const f = makeFields(client);
  assert.deepEqual(await f.delete('F2'), { id: 'F2' });
});
