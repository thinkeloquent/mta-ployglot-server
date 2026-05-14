import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paginate } from '../../src/client/paginate.mjs';

test('walks two pages', async () => {
  let calls = 0;
  const client = {
    async graphql(_query, vars) {
      calls++;
      if (vars.after == null) {
        return { node: { items: { nodes: [{ id: 1 }, { id: 2 }], pageInfo: { hasNextPage: true, endCursor: 'a' } } } };
      }
      return { node: { items: { nodes: [{ id: 3 }], pageInfo: { hasNextPage: false, endCursor: 'b' } } } };
    },
  };
  const out = [];
  for await (const n of paginate(client, { query: 'q', variables: {}, path: 'node.items' })) out.push(n);
  assert.deepEqual(out, [{ id: 1 }, { id: 2 }, { id: 3 }]);
  assert.equal(calls, 2);
});

test('hasNextPage false on first page completes', async () => {
  const client = {
    async graphql() {
      return { p: { c: { nodes: [{ id: 'x' }], pageInfo: { hasNextPage: false } } } };
    },
  };
  const out = [];
  for await (const n of paginate(client, { query: 'q', variables: {}, path: 'p.c' })) out.push(n);
  assert.deepEqual(out, [{ id: 'x' }]);
});

test('empty nodes completes without yielding', async () => {
  const client = {
    async graphql() {
      return { p: { c: { nodes: [], pageInfo: { hasNextPage: false } } } };
    },
  };
  const out = [];
  for await (const n of paginate(client, { query: 'q', variables: {}, path: 'p.c' })) out.push(n);
  assert.deepEqual(out, []);
});
