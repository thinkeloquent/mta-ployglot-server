import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ComputeRegistry } from '../src/compute-registry.mjs';
import { ComputeScope } from '../src/options.mjs';
import { ComputeFunctionError, ErrorCode } from '../src/errors.mjs';

test('register + has + list + getScope', () => {
  const reg = new ComputeRegistry();
  reg.register('alpha', () => 1, ComputeScope.STARTUP);
  reg.register('beta', () => 2);
  assert.equal(reg.has('alpha'), true);
  assert.equal(reg.has('beta'), true);
  assert.deepEqual(reg.list().sort(), ['alpha', 'beta']);
  assert.equal(reg.getScope('alpha'), ComputeScope.STARTUP);
  assert.equal(reg.getScope('beta'), ComputeScope.REQUEST);
});

test('unregister returns true if removed, false if absent', () => {
  const reg = new ComputeRegistry();
  reg.register('x', () => 1);
  assert.equal(reg.unregister('x'), true);
  assert.equal(reg.unregister('x'), false);
});

test('clear removes everything; clearCache only the cache', async () => {
  const reg = new ComputeRegistry();
  reg.register('cached', () => Math.random(), ComputeScope.STARTUP);
  const first = await reg.resolve('cached', {});
  const second = await reg.resolve('cached', {});
  assert.equal(first, second);
  reg.clearCache();
  const third = await reg.resolve('cached', {});
  assert.notEqual(first, third);
  reg.clear();
  assert.equal(reg.has('cached'), false);
});

test('name validation throws for bad names', () => {
  const reg = new ComputeRegistry();
  assert.throws(() => reg.register('1bad', () => 1), /Invalid function name/);
  assert.throws(() => reg.register('has-dash', () => 1), /Invalid function name/);
});

test('STARTUP scope caches; REQUEST never caches', async () => {
  const reg = new ComputeRegistry();
  let calls = 0;
  reg.register('startup', () => ++calls, ComputeScope.STARTUP);
  reg.register('request', () => ++calls, ComputeScope.REQUEST);
  await reg.resolve('startup', {});
  await reg.resolve('startup', {});
  assert.equal(calls, 1);
  await reg.resolve('request', {});
  await reg.resolve('request', {});
  assert.equal(calls, 3);
});

test('STARTUP cache key includes propertyPath', async () => {
  const reg = new ComputeRegistry();
  let calls = 0;
  reg.register('keyed', (_ctx, path) => `${path}:${++calls}`, ComputeScope.STARTUP);
  const a1 = await reg.resolve('keyed', {}, 'a');
  const a2 = await reg.resolve('keyed', {}, 'a');
  const b1 = await reg.resolve('keyed', {}, 'b');
  assert.equal(a1, a2);
  assert.notEqual(a1, b1);
});

test('unknown name throws ComputeFunctionError NOT_FOUND', async () => {
  const reg = new ComputeRegistry();
  await assert.rejects(
    () => reg.resolve('nope', {}),
    (err) =>
      err instanceof ComputeFunctionError && err.code === ErrorCode.COMPUTE_FUNCTION_NOT_FOUND,
  );
});

test('throwing function wraps as ComputeFunctionError FAILED', async () => {
  const reg = new ComputeRegistry();
  reg.register('boom', () => { throw new Error('kaboom'); });
  await assert.rejects(
    () => reg.resolve('boom', {}),
    (err) =>
      err instanceof ComputeFunctionError &&
      err.code === ErrorCode.COMPUTE_FUNCTION_FAILED &&
      err.ctx.originalError === 'kaboom',
  );
});

test('async function is awaited', async () => {
  const reg = new ComputeRegistry();
  reg.register('async_fn', async () => 'ok');
  assert.equal(await reg.resolve('async_fn', {}), 'ok');
});
