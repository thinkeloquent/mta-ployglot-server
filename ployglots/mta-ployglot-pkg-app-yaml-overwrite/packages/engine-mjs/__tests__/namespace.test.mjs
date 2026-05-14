import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ContextResolver } from '../src/context-resolver.mjs';

test('registerNamespace overrides env-resolve dispatch', async () => {
  const r = new ContextResolver();
  const calls = [];
  r.registerNamespace('env', (varName, defaultVal) => {
    calls.push([varName, defaultVal]);
    return `vault:${varName}`;
  });
  assert.equal(await r.resolve('{{env.DB_PASSWORD}}', {}), 'vault:DB_PASSWORD');
  assert.deepEqual(calls, [['DB_PASSWORD', undefined]]);
});

test('unregisterNamespace restores default env-resolve dispatch', async () => {
  const r = new ContextResolver();
  r.registerNamespace('env', () => 'vault');
  assert.equal(await r.resolve('{{env.HOME}}', {}), 'vault');
  r.unregisterNamespace('env');
  // default dispatch falls back to envResolve
  process.env.RTR_TEST_NS = 'default-back';
  assert.equal(await r.resolve('{{env.RTR_TEST_NS}}', {}), 'default-back');
  delete process.env.RTR_TEST_NS;
});

test('registerNamespace passes default value to handler', async () => {
  const r = new ContextResolver();
  let received;
  r.registerNamespace('env', (_varName, defaultVal) => {
    received = defaultVal;
    return 'X';
  });
  await r.resolve('{{env.K | "42"}}', {});
  assert.equal(received, 42);
});
