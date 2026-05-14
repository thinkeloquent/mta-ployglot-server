import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { AppYamlConfig } from '../src/core.mjs';
import { AppYamlConfigSDK } from '../src/sdk.mjs';

beforeEach(() => AppYamlConfig._resetForTesting());

const fixture = () =>
  new Map([
    [
      'a.yml',
      {
        global: { region: 'us' },
        providers: { gemini: { api_key: 'g-key' }, openai: {} },
        services: { auth: {} },
        storage: { redis: {} },
      },
    ],
  ]);

const buildSdk = async () => {
  await AppYamlConfig.initialize({ loaded: fixture() });
  return new AppYamlConfigSDK(AppYamlConfig.getInstance());
};

test('getAll returns deep clone of merged config', async () => {
  const sdk = await buildSdk();
  const all = sdk.getAll();
  all.providers.gemini.api_key = 'tampered';
  assert.equal(sdk.get('providers.gemini.api_key'), 'g-key');
});

test('listProviders / listServices / listStorages', async () => {
  const sdk = await buildSdk();
  assert.deepEqual(sdk.listProviders().sort(), ['gemini', 'openai']);
  assert.deepEqual(sdk.listServices(), ['auth']);
  assert.deepEqual(sdk.listStorages(), ['redis']);
});

test('list helpers return [] when key absent', async () => {
  AppYamlConfig._resetForTesting();
  await AppYamlConfig.initialize({ loaded: new Map([['a.yml', { x: 1 }]]) });
  const sdk = new AppYamlConfigSDK(AppYamlConfig.getInstance());
  assert.deepEqual(sdk.listProviders(), []);
  assert.deepEqual(sdk.listServices(), []);
  assert.deepEqual(sdk.listStorages(), []);
});

test('dot-path get returns nested value', async () => {
  const sdk = await buildSdk();
  assert.equal(sdk.get('providers.gemini.api_key'), 'g-key');
  assert.equal(sdk.get('providers.gemini.api_key', '(none)'), 'g-key');
});

test('dot-path get returns default for missing path', async () => {
  const sdk = await buildSdk();
  assert.equal(sdk.get('missing.x.y', 0), 0);
  assert.equal(sdk.get('providers.missing', 'x'), 'x');
});

test('fromDirectory error path names app-yaml-loader when loader missing', async () => {
  await assert.rejects(
    AppYamlConfigSDK.fromDirectory('./nonexistent'),
    /app-yaml-loader/
  );
});
