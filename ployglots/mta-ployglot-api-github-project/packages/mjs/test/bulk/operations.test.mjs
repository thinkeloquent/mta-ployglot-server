import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBulk } from '../../src/bulk/index.mjs';

function stubValues({ failEvery = Infinity } = {}) {
  let n = 0, peak = 0, active = 0;
  const calls = [];
  return {
    values: {
      set: async (projId, itemId) => {
        active++; peak = Math.max(peak, active); n++;
        calls.push({ itemId });
        await new Promise(r => setTimeout(r, 5));
        active--;
        if (n % failEvery === 0) throw new Error(`failed at ${n}`);
        return { id: itemId };
      },
      resolveFieldIdByName: async () => 'PVTF_x',
    },
    items: { add: async (_p, contentId) => ({ id: contentId }) },
    metrics: { peak: () => peak, calls: () => calls.length },
  };
}

test('partial failure shape', async () => {
  const stubs = stubValues({ failEvery: 33 });
  const bulk = makeBulk({}, { values: stubs.values, items: stubs.items, relations: { dependencies: { graph: async () => ({ nodes: [], edges: [] }) } } });
  const inputs = Array.from({ length: 100 }, (_, i) => ({ itemId: `i${i}`, fieldUpdates: { 'Status': 'Done' } }));
  const r = await bulk.updateItems('p', inputs, { concurrency: 5 });
  assert.equal(r.failed.length, 3);
  assert.equal(r.ok.length, 97);
});

test('concurrency cap honored', async () => {
  const stubs = stubValues();
  const bulk = makeBulk({}, { values: stubs.values, items: stubs.items, relations: { dependencies: { graph: async () => ({ nodes: [], edges: [] }) } } });
  const inputs = Array.from({ length: 30 }, (_, i) => ({ itemId: `i${i}`, fieldUpdates: { 'PVTF_x': 'v' } }));
  await bulk.updateItems('p', inputs, { concurrency: 4 });
  assert.ok(stubs.metrics.peak() <= 4);
});

test('assignField sets same value across items', async () => {
  const stubs = stubValues();
  const bulk = makeBulk({}, { values: stubs.values, items: stubs.items, relations: { dependencies: { graph: async () => ({ nodes: [], edges: [] }) } } });
  const r = await bulk.assignField('p', { fieldId: 'F', value: 'X' }, ['i1', 'i2', 'i3']);
  assert.equal(r.ok.length, 3);
  assert.deepEqual(r.ok.map(o => o.id), ['i1', 'i2', 'i3'].sort().sort());
});

test('moveStatus delegates to assignField', async () => {
  const stubs = stubValues();
  const bulk = makeBulk({}, { values: stubs.values, items: stubs.items, relations: { dependencies: { graph: async () => ({ nodes: [], edges: [] }) } } });
  const r = await bulk.moveStatus('p', { statusFieldId: 'F_S', optionId: 'O_DONE' }, ['i1', 'i2']);
  assert.equal(r.ok.length, 2);
});

test('bulkAdd runs items.add for each contentId', async () => {
  const stubs = stubValues();
  const bulk = makeBulk({}, { values: stubs.values, items: stubs.items, relations: { dependencies: { graph: async () => ({ nodes: [], edges: [] }) } } });
  const r = await bulk.bulkAdd('p', ['c1', 'c2', 'c3']);
  assert.equal(r.ok.length, 3);
});

test('validateDependencyGraph returns cycles', async () => {
  const relations = { dependencies: { graph: async () => ({
    nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'c', to: 'a' }],
  }) } };
  const bulk = makeBulk({}, { values: {}, items: {}, relations });
  const r = await bulk.validateDependencyGraph('p');
  assert.equal(r.cycles.length, 1);
});

test('validateDependencyGraph empty for acyclic', async () => {
  const relations = { dependencies: { graph: async () => ({
    nodes: [{ id: 'a' }, { id: 'b' }],
    edges: [{ from: 'a', to: 'b' }],
  }) } };
  const bulk = makeBulk({}, { values: {}, items: {}, relations });
  assert.deepEqual((await bulk.validateDependencyGraph('p')).cycles, []);
});
