import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { applyOverwritesFromContext } from '../src/applier.mjs';
import { deepMergeWithNullReplace } from '../src/deep-merge-null.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = pathResolve(__dirname, '../../../parity/applier-nested.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));

function clone(o) { return JSON.parse(JSON.stringify(o)); }

test('top-level overwrite_from_env writes resolved value', async () => {
  process.env.TEST_KEY = 'live-key';
  process.env.GEMINI_TIMEOUT = '12000';
  const out = await applyOverwritesFromContext(clone(fixture), {
    context: { request: { host: 'api.example.com' } },
  });
  assert.equal(out.api_key, 'live-key');
  delete process.env.TEST_KEY;
  delete process.env.GEMINI_TIMEOUT;
});

test('nested overwrite_from_context resolves with env default', async () => {
  delete process.env.GEMINI_TIMEOUT;
  process.env.TEST_KEY = 'k';
  const out = await applyOverwritesFromContext(clone(fixture), {
    context: { request: { host: 'api.example.com' } },
  });
  // Default coerces to number 5000.
  assert.equal(out.providers.gemini.timeout, 5000);
  delete process.env.TEST_KEY;
});

test('nested overwrite_from_context resolves {{request.host}}', async () => {
  process.env.TEST_KEY = 'k';
  const out = await applyOverwritesFromContext(clone(fixture), {
    context: { request: { host: 'api.example.com' } },
  });
  assert.equal(out.services.x.url, 'api.example.com');
  delete process.env.TEST_KEY;
});

test('null in overwrite_from_context deletes parent key', async () => {
  process.env.TEST_KEY = 'k';
  const out = await applyOverwritesFromContext(clone(fixture), {
    context: { request: { host: 'h' } },
  });
  assert.equal(Object.prototype.hasOwnProperty.call(out.services.x, 'deprecated_field'), false);
  delete process.env.TEST_KEY;
});

test('original overwrite sections preserved (resolved) for diagnostics', async () => {
  process.env.TEST_KEY = 'k';
  process.env.GEMINI_TIMEOUT = '777';
  const out = await applyOverwritesFromContext(clone(fixture), {
    context: { request: { host: 'h' } },
  });
  assert.deepEqual(out.overwrite_from_env, { api_key: 'TEST_KEY' });
  assert.deepEqual(out.providers.gemini.overwrite_from_context, { timeout: '777' });
  assert.equal(out.services.x.overwrite_from_context.url, 'h');
  assert.equal(out.services.x.overwrite_from_context.deprecated_field, null);
  delete process.env.TEST_KEY;
  delete process.env.GEMINI_TIMEOUT;
});

test('input config is not mutated', async () => {
  const cfg = clone(fixture);
  const before = JSON.stringify(cfg);
  process.env.TEST_KEY = 'k';
  await applyOverwritesFromContext(cfg, { context: { request: { host: 'h' } } });
  assert.equal(JSON.stringify(cfg), before);
  delete process.env.TEST_KEY;
});

test('applier accepts a hand-rolled resolver (no engine import path)', async () => {
  const customResolver = {
    async resolve(expr) { return typeof expr === 'string' ? expr.toUpperCase() : expr; },
    async resolveObject(obj) {
      if (Array.isArray(obj)) return Promise.all(obj.map((v) => this.resolveObject(v)));
      if (obj && typeof obj === 'object') {
        const out = {};
        for (const k of Object.keys(obj)) out[k] = await this.resolveObject(obj[k]);
        return out;
      }
      return typeof obj === 'string' ? obj.toUpperCase() : obj;
    },
  };
  const cfg = {
    api_key: null,
    overwrite_from_context: { api_key: 'fallback-key' },
  };
  const out = await applyOverwritesFromContext(cfg, { resolver: customResolver });
  assert.deepEqual(out, {
    api_key: 'FALLBACK-KEY',
    overwrite_from_context: { api_key: 'FALLBACK-KEY' },
  });
});

test('walker without overwrites returns deep clone of input', async () => {
  const cfg = { a: 1, b: { c: [1, 2] }, d: 'plain' };
  const noopResolver = { async resolve(x) { return x; }, async resolveObject(x) { return x; } };
  const out = await applyOverwritesFromContext(cfg, { resolver: noopResolver });
  assert.deepEqual(out, cfg);
  assert.notEqual(out, cfg);
});

test('arrays are preserved as arrays', async () => {
  const cfg = { items: [1, 2, 3] };
  const noopResolver = { async resolve(x) { return x; }, async resolveObject(x) { return x; } };
  const out = await applyOverwritesFromContext(cfg, { resolver: noopResolver });
  assert.ok(Array.isArray(out.items));
  assert.deepEqual(out.items, [1, 2, 3]);
});

test('deepMergeWithNullReplace remains exported', () => {
  assert.equal(typeof deepMergeWithNullReplace, 'function');
});
