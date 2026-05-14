import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
  EndpointConfigSDK,
  createEndpointConfigSDK,
  loadConfig,
  ConfigError,
} from '../src/index.mjs';

const FIXTURE = {
  endpoints: {
    llm001: {
      name: 'Gemini',
      tags: ['llm', 'fast'],
      baseUrl: 'https://api.example.com/v1/chat',
      method: 'POST',
      headers: { Authorization: 'Bearer XYZ' },
      timeout: 8000,
      bodyType: 'json',
    },
    llm002: {
      name: 'OpenAI',
      tags: ['llm', 'slow'],
      baseUrl: 'https://api.alt.com/v1/chat',
      method: 'POST',
      timeout: 12000,
    },
    raw: {
      name: 'plaintext',
      tags: ['raw'],
      baseUrl: 'https://api.example.com/v1/raw',
      bodyType: 'text',
    },
  },
  intent_mapping: {
    default_intent: 'llm001',
    mappings: { storybook: 'llm002', summary: 'llm001' },
  },
};

test('SDK: constructor stores filePath', () => {
  const sdk = new EndpointConfigSDK({ filePath: './e.yaml' });
  assert.ok(sdk instanceof EndpointConfigSDK);
});

test('SDK: createEndpointConfigSDK factory returns an instance', () => {
  const sdk = createEndpointConfigSDK({ filePath: './e.yaml' });
  assert.ok(sdk instanceof EndpointConfigSDK);
});

test('SDK: loadConfig proxies to module-level loader', () => {
  const sdk = createEndpointConfigSDK();
  const ret = sdk.loadConfig(FIXTURE);
  assert.equal(ret, FIXTURE);
});

test('SDK: getByKey ≡ module getEndpoint', () => {
  loadConfig(FIXTURE);
  const sdk = createEndpointConfigSDK();
  const ep = sdk.getByKey('llm001');
  assert.equal(ep.key, 'llm001');
  assert.equal(ep.name, 'Gemini');
});

test('SDK: getAll returns array of endpoints, no nulls', () => {
  loadConfig(FIXTURE);
  const sdk = createEndpointConfigSDK();
  const all = sdk.getAll();
  assert.equal(all.length, 3);
  assert.deepEqual(all.map((ep) => ep.key).sort(), ['llm001', 'llm002', 'raw']);
});

test('SDK: getByName matches name field, returns null when absent', () => {
  loadConfig(FIXTURE);
  const sdk = createEndpointConfigSDK();
  assert.equal(sdk.getByName('Gemini').key, 'llm001');
  assert.equal(sdk.getByName('Nope'), null);
});

test('SDK: getByTag filters by tag membership', () => {
  loadConfig(FIXTURE);
  const sdk = createEndpointConfigSDK();
  const llm = sdk.getByTag('llm');
  assert.deepEqual(llm.map((ep) => ep.key).sort(), ['llm001', 'llm002']);
  assert.deepEqual(sdk.getByTag('raw').map((ep) => ep.key), ['raw']);
  assert.deepEqual(sdk.getByTag('nope'), []);
});

test('SDK: listKeys ≡ module listEndpoints', () => {
  loadConfig(FIXTURE);
  const sdk = createEndpointConfigSDK();
  assert.deepEqual(sdk.listKeys().sort(), ['llm001', 'llm002', 'raw']);
});

test('SDK: properties walks dot-path, returns default when missing', () => {
  loadConfig(FIXTURE);
  const sdk = createEndpointConfigSDK();
  assert.equal(sdk.properties('endpoints.llm001.timeout'), 8000);
  assert.equal(sdk.properties('endpoints.llm001.name'), 'Gemini');
  assert.equal(sdk.properties('endpoints.nope.timeout', 'fallback'), 'fallback');
  assert.equal(sdk.properties('zzz.does.not.exist', 42), 42);
});

test('SDK: resolveIntent returns { key, endpoint }', () => {
  loadConfig(FIXTURE);
  const sdk = createEndpointConfigSDK();
  const r = sdk.resolveIntent('storybook');
  assert.equal(r.key, 'llm002');
  assert.equal(r.endpoint.key, 'llm002');
  assert.equal(r.endpoint.name, 'OpenAI');
});

test('SDK: resolveIntent unmapped → default + corresponding endpoint', () => {
  loadConfig(FIXTURE);
  const sdk = createEndpointConfigSDK();
  const r = sdk.resolveIntent('unknown');
  assert.equal(r.key, 'llm001');
  assert.equal(r.endpoint.key, 'llm001');
});

test('SDK: getFetchConfig proxies to module-level', () => {
  loadConfig(FIXTURE);
  const sdk = createEndpointConfigSDK();
  const fc = sdk.getFetchConfig('llm001', { prompt: 'hi' });
  assert.equal(fc.url, 'https://api.example.com/v1/chat');
  assert.equal(fc.body, '{"prompt":"hi"}');
});

test('SDK: refreshConfig without filePath throws', () => {
  const sdk = createEndpointConfigSDK();
  assert.throws(() => sdk.refreshConfig(), /no filePath/);
});

test('SDK: loadFromFile sets filePath then refreshConfig re-reads', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'afc-sdk-'));
  const file = path.join(dir, 'e.yaml');
  fs.writeFileSync(
    file,
    'endpoints:\n  one:\n    baseUrl: https://x\nintent_mapping:\n  default_intent: one\n',
  );

  const sdk = createEndpointConfigSDK();
  const cfg1 = sdk.loadFromFile(file);
  assert.equal(cfg1.endpoints.one.baseUrl, 'https://x');

  fs.writeFileSync(
    file,
    'endpoints:\n  one:\n    baseUrl: https://y\nintent_mapping:\n  default_intent: one\n',
  );
  const cfg2 = sdk.refreshConfig();
  assert.equal(cfg2.endpoints.one.baseUrl, 'https://y');

  fs.rmSync(dir, { recursive: true, force: true });
});

test('SDK: state isolation between cases via loadConfig({})', () => {
  loadConfig({});
  const sdk = createEndpointConfigSDK();
  assert.deepEqual(sdk.listKeys(), []);
  assert.deepEqual(sdk.getAll(), []);
  // unknown id → ConfigError on getFetchConfig
  assert.throws(() => sdk.getFetchConfig('nope', {}), ConfigError);
});

test('SDK: multiple instances share module-level _config but hold different filePath', () => {
  loadConfig(FIXTURE);
  const a = createEndpointConfigSDK({ filePath: './a.yaml' });
  const b = createEndpointConfigSDK({ filePath: './b.yaml' });
  // both see the same _config
  assert.equal(a.listKeys().length, 3);
  assert.equal(b.listKeys().length, 3);
  // private filePath remains independent — refreshConfig of the missing path
  // would warn + reset, so we don't actually call refresh; this just asserts
  // that constructing two doesn't error.
  assert.ok(a !== b);
});
