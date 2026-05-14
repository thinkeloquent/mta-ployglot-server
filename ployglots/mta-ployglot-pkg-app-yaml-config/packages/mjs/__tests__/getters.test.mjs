import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { AppYamlConfig } from '../src/core.mjs';

beforeEach(() => AppYamlConfig._resetForTesting());

const fixture = () =>
  new Map([
    [
      'a.yml',
      {
        global: { region: 'us', timeout: 5000 },
        providers: { gemini: { api_key: 'g-key' }, openai: { timeout: 1000 } },
        services: { auth: { url: 'https://auth' } },
      },
    ],
  ]);

test('get returns top-level value', async () => {
  const inst = await AppYamlConfig.initialize({ loaded: fixture() });
  assert.deepEqual(inst.get('global'), { region: 'us', timeout: 5000 });
});

test('get returns default for missing key', async () => {
  const inst = await AppYamlConfig.initialize({ loaded: fixture() });
  assert.equal(inst.get('missing', 0), 0);
});

test('get returns deep clone (mutation does not poison singleton)', async () => {
  const inst = await AppYamlConfig.initialize({ loaded: fixture() });
  const v = inst.get('global');
  v.region = 'eu';
  assert.equal(inst.get('global').region, 'us');
});

test('getNested walks the path', async () => {
  const inst = await AppYamlConfig.initialize({ loaded: fixture() });
  assert.equal(inst.getNested(['providers', 'gemini', 'api_key']), 'g-key');
});

test('getNested returns default for missing intermediate node', async () => {
  const inst = await AppYamlConfig.initialize({ loaded: fixture() });
  assert.equal(inst.getNested(['providers', 'missing', 'api_key'], 0), 0);
});

test('getAll returns deep clone', async () => {
  const inst = await AppYamlConfig.initialize({ loaded: fixture() });
  const all = inst.getAll();
  all.providers.gemini.api_key = 'tampered';
  assert.equal(inst.getNested(['providers', 'gemini', 'api_key']), 'g-key');
});

test('getGlobalAppConfig returns deep clone of global', async () => {
  const inst = await AppYamlConfig.initialize({ loaded: fixture() });
  const g = inst.getGlobalAppConfig();
  g.region = 'eu';
  assert.equal(inst.getGlobalAppConfig().region, 'us');
});

test('getGlobalAppConfig returns {} when global absent', async () => {
  const inst = await AppYamlConfig.initialize({ loaded: new Map([['x.yml', { providers: {} }]]) });
  assert.deepEqual(inst.getGlobalAppConfig(), {});
});
