import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeValues } from '../../src/resources/field-values.mjs';

function stub(handler) {
  const calls = [];
  return {
    calls,
    async graphql(q, v) { calls.push({ q, v }); return await handler(q, v, calls.length); },
  };
}

const sampleItem = (overrides = {}) => ({
  id: 'I1', type: 'ISSUE', isArchived: false, content: {},
  fieldValues: [
    { fieldId: 'F1', fieldName: 'Notes', value: 'hello' },
    { fieldId: 'F2', fieldName: 'Status', value: { optionId: 'O1', optionName: 'Done', color: 'GREEN' } },
  ],
  ...overrides,
});

test('get returns matching value', async () => {
  const items = { async get() { return sampleItem(); } };
  const v = makeValues(stub(() => ({})), { items, fields: {} });
  assert.deepEqual((await v.get('I1', 'F2')).value.optionName, 'Done');
});

test('get returns null when not found', async () => {
  const items = { async get() { return sampleItem(); } };
  const v = makeValues(stub(() => ({})), { items, fields: {} });
  assert.equal(await v.get('I1', 'F999'), null);
});

test('list returns all values', async () => {
  const items = { async get() { return sampleItem(); } };
  const v = makeValues(stub(() => ({})), { items, fields: {} });
  assert.equal((await v.list('I1')).length, 2);
});

test('findItemsWithValue filters with predicate', async () => {
  const items = {
    async *list() {
      yield sampleItem({ id: 'I1' });
      yield { ...sampleItem({ id: 'I2' }), fieldValues: [{ fieldId: 'F2', fieldName: 'Status', value: { optionName: 'Todo' } }] };
      yield sampleItem({ id: 'I3' });
    },
  };
  const v = makeValues(stub(() => ({})), { items, fields: {} });
  const out = await v.findItemsWithValue('P', 'Status', (val) => val.optionName === 'Done');
  assert.deepEqual(out.map(i => i.id), ['I1', 'I3']);
});

test('findItemsWithValue skips items without that field', async () => {
  const items = {
    async *list() {
      yield { id: 'I1', fieldValues: [] };
      yield sampleItem({ id: 'I2' });
    },
  };
  const v = makeValues(stub(() => ({})), { items, fields: {} });
  const out = await v.findItemsWithValue('P', 'Status', () => true);
  assert.deepEqual(out.map(i => i.id), ['I2']);
});

test('set on Title throws FieldNotWritableError', async () => {
  const items = { async get() { return {}; } };
  const fields = { async get() { return { id: 'F1', name: 'Title', dataType: 'TEXT' }; } };
  const v = makeValues(stub(() => ({})), { items, fields });
  await assert.rejects(v.set('P', 'I', 'F1', 'new'), (err) => err.name === 'FieldNotWritableError');
});

test('set SINGLE_SELECT resolves name to id', async () => {
  let n = 0;
  const items = { async get() { return {}; } };
  const fields = {
    async get() {
      return { id: 'F2', name: 'Status', dataType: 'SINGLE_SELECT', options: [{ id: 'O1', name: 'Done' }] };
    },
  };
  const c = stub(() => ({ updateProjectV2ItemFieldValue: { projectV2Item: { id: 'I' } } }));
  const v = makeValues(c, { items, fields });
  await v.set('P', 'I', 'F2', 'Done');
  assert.equal(c.calls[0].v.input.value.singleSelectOptionId, 'O1');
});

test('set with name not in options throws FieldOptionNotFoundError', async () => {
  const items = { async get() { return {}; } };
  const fields = {
    async get() {
      return { id: 'F2', name: 'Status', dataType: 'SINGLE_SELECT', options: [{ id: 'O1', name: 'Done' }] };
    },
  };
  const v = makeValues(stub(() => ({})), { items, fields });
  await assert.rejects(v.set('P', 'I', 'F2', 'Bogus'), (err) =>
    err.name === 'FieldOptionNotFoundError' && err.available.includes('Done'));
});

test('set DATE forwards yyyy-mm-dd', async () => {
  const items = { async get() { return {}; } };
  const fields = { async get() { return { id: 'F', name: 'Due', dataType: 'DATE' }; } };
  const c = stub(() => ({ updateProjectV2ItemFieldValue: { projectV2Item: { id: 'I' } } }));
  const v = makeValues(c, { items, fields });
  await v.set('P', 'I', 'F', '2026-04-21');
  assert.equal(c.calls[0].v.input.value.date, '2026-04-21');
});

test('set ITERATION accepts both id-string and object', async () => {
  const items = { async get() { return {}; } };
  const fields = { async get() { return { id: 'F', name: 'Sprint', dataType: 'ITERATION' }; } };
  const c = stub(() => ({ updateProjectV2ItemFieldValue: { projectV2Item: { id: 'I' } } }));
  const v = makeValues(c, { items, fields });
  await v.set('P', 'I', 'F', 'IT_1');
  assert.equal(c.calls[0].v.input.value.iterationId, 'IT_1');
  await v.set('P', 'I', 'F', { iterationId: 'IT_2' });
  assert.equal(c.calls[1].v.input.value.iterationId, 'IT_2');
});

test('set caches field metadata across calls', async () => {
  let getCount = 0;
  const items = { async get() { return {}; } };
  const fields = {
    async get() {
      getCount++;
      return { id: 'F', name: 'Notes', dataType: 'TEXT' };
    },
  };
  const c = stub(() => ({ updateProjectV2ItemFieldValue: { projectV2Item: { id: 'I' } } }));
  const v = makeValues(c, { items, fields });
  await v.set('P', 'I', 'F', 'a');
  await v.set('P', 'I', 'F', 'b');
  assert.equal(getCount, 1);
});

test('clear posts the mutation', async () => {
  const items = { async get() { return {}; } };
  const fields = { async get() { return {}; } };
  const c = stub(() => ({ clearProjectV2ItemFieldValue: { projectV2Item: { id: 'I' } } }));
  const v = makeValues(c, { items, fields });
  const out = await v.clear('P', 'I', 'F');
  assert.deepEqual(out, { id: 'I' });
});
