import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ContextResolver } from '../src/context-resolver.mjs';

test('{{env.SET_VAR}} returns its value', async () => {
  process.env.RTR_TEST_SET = 'alice';
  const r = new ContextResolver();
  assert.equal(await r.resolve('{{env.RTR_TEST_SET}}', {}), 'alice');
  delete process.env.RTR_TEST_SET;
});

test('{{env.MISSING | "fb"}} returns the literal default', async () => {
  delete process.env.RTR_TEST_MISSING;
  const r = new ContextResolver();
  assert.equal(await r.resolve('{{env.RTR_TEST_MISSING | "fb"}}', {}), 'fb');
});

test('{{env.MISSING | "42"}} returns numeric default', async () => {
  delete process.env.RTR_TEST_MISSING;
  const r = new ContextResolver();
  assert.equal(await r.resolve('{{env.RTR_TEST_MISSING | "42"}}', {}), 42);
});

test('{{env.MISSING | "true"}} returns boolean default', async () => {
  delete process.env.RTR_TEST_MISSING;
  const r = new ContextResolver();
  assert.equal(await r.resolve('{{env.RTR_TEST_MISSING | "true"}}', {}), true);
});

test('{{env.SET_VAR | "ignored"}} prefers actual env value', async () => {
  process.env.RTR_TEST_BOTH = 'real';
  const r = new ContextResolver();
  assert.equal(await r.resolve('{{env.RTR_TEST_BOTH | "ignored"}}', {}), 'real');
  delete process.env.RTR_TEST_BOTH;
});

test('numeric/string default distinction respected', async () => {
  const r = new ContextResolver();
  delete process.env.RTR_X;
  assert.equal(await r.resolve('{{env.RTR_X | "literal"}}', {}), 'literal');
});
