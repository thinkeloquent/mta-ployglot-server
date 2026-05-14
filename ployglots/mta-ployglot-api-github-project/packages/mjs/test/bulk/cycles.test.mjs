import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findCycles } from '../../src/bulk/cycles.mjs';

test('3-cycle detected', () => {
  const g = {
    nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'c', to: 'a' }],
  };
  const c = findCycles(g);
  assert.equal(c.length, 1);
  assert.equal(c[0][0], c[0][c[0].length - 1]);
});

test('acyclic returns empty', () => {
  const g = {
    nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }],
  };
  assert.deepEqual(findCycles(g), []);
});

test('null/missing from is skipped', () => {
  const g = {
    nodes: [{ id: 'a' }, { id: 'b' }],
    edges: [{ from: null, to: 'a' }, { from: 'a', to: 'b' }],
  };
  assert.deepEqual(findCycles(g), []);
});

test('itemId fallback works', () => {
  const g = {
    nodes: [{ itemId: 'x' }, { itemId: 'y' }],
    edges: [{ from: 'x', to: 'y' }, { from: 'y', to: 'x' }],
  };
  const c = findCycles(g);
  assert.equal(c.length, 1);
});
