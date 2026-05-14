import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { AppYamlConfig } from '../src/core.mjs';

beforeEach(() => AppYamlConfig._resetForTesting());

const loadedFixture = () =>
  new Map([
    ['a.yml', { x: 1, global: { timeout: 5000 }, providers: { gemini: {} } }],
    ['b.yml', { y: 2 }],
  ]);

test('initialize({ loaded }) populates state', async () => {
  const inst = await AppYamlConfig.initialize({ loaded: loadedFixture() });
  assert.equal(inst.get('x'), 1);
  assert.equal(inst.get('y'), 2);
  assert.deepEqual(inst.getNested(['providers', 'gemini']), { timeout: 5000 });
});

test('re-initialize returns the same instance (no rebuild)', async () => {
  const a = await AppYamlConfig.initialize({ loaded: loadedFixture() });
  const b = await AppYamlConfig.initialize({ loaded: new Map([['z.yml', { z: 99 }]]) });
  assert.equal(a, b);
  assert.equal(b.get('z', '(none)'), '(none)');
});

test('getInstance() before init throws', () => {
  AppYamlConfig._resetForTesting();
  assert.throws(() => AppYamlConfig.getInstance(), /not initialized/);
});

test('getInstance() after init returns the singleton', async () => {
  const inst = await AppYamlConfig.initialize({ loaded: loadedFixture() });
  assert.equal(AppYamlConfig.getInstance(), inst);
});

test('_resetForTesting clears the singleton ref', async () => {
  await AppYamlConfig.initialize({ loaded: loadedFixture() });
  AppYamlConfig._resetForTesting();
  assert.throws(() => AppYamlConfig.getInstance());
});

test('initialize with no loader and no input throws naming app-yaml-loader', async () => {
  await assert.rejects(
    AppYamlConfig.initialize({}),
    /app-yaml-loader/
  );
});

test('snapshot is a separate object from _config', async () => {
  const inst = await AppYamlConfig.initialize({ loaded: loadedFixture() });
  assert.notEqual(inst._config, inst._initialMergedConfig);
  assert.deepEqual(inst._config, inst._initialMergedConfig);
});

test('restore() returns _config to the post-init snapshot', async () => {
  const inst = await AppYamlConfig.initialize({ loaded: loadedFixture() });
  const before = inst.getAll();
  inst._config.x = 999; // privileged escape — bypass the immutability stubs
  assert.equal(inst.get('x'), 999);
  inst.restore();
  assert.deepEqual(inst.getAll(), before);
  assert.equal(inst.get('x'), 1);
});

test('mutating _config does not affect _initialMergedConfig', async () => {
  const inst = await AppYamlConfig.initialize({ loaded: loadedFixture() });
  inst._config.x = 999;
  assert.equal(inst._initialMergedConfig.x, 1);
});
