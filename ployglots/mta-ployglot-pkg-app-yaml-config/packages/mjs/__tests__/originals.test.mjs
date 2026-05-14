import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { AppYamlConfig } from '../src/core.mjs';

beforeEach(() => AppYamlConfig._resetForTesting());

const fixture = () =>
  new Map([
    ['a.yml', { x: 1 }],
    ['b.yml', { y: 2, providers: { p: { api_key: 'k' } } }],
  ]);

test('getOriginal returns deep clone of parsed file', async () => {
  const inst = await AppYamlConfig.initialize({ loaded: fixture() });
  const orig = inst.getOriginal('b.yml');
  assert.deepEqual(orig, { y: 2, providers: { p: { api_key: 'k' } } });
  orig.providers.p.api_key = 'tampered';
  assert.equal(inst.getOriginal('b.yml').providers.p.api_key, 'k');
});

test('getOriginal returns undefined for absent file', async () => {
  const inst = await AppYamlConfig.initialize({ loaded: fixture() });
  assert.equal(inst.getOriginal('missing.yml'), undefined);
});

test('getOriginalAll returns Map of clones', async () => {
  const inst = await AppYamlConfig.initialize({ loaded: fixture() });
  const all = inst.getOriginalAll();
  assert.equal(all.size, 2);
  all.get('a.yml').x = 999;
  assert.equal(inst.getOriginal('a.yml').x, 1);
});
