import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { AppYamlConfig } from '../src/core.mjs';
import { ImmutabilityError } from '../src/errors.mjs';

beforeEach(() => AppYamlConfig._resetForTesting());

const init = () =>
  AppYamlConfig.initialize({
    loaded: new Map([['a.yml', { x: 1, providers: { p: { y: 2 } } }]]),
  });

for (const method of ['set', 'update', 'reset', 'clear']) {
  test(`${method}() throws ImmutabilityError`, async () => {
    const inst = await init();
    const before = inst.getAll();
    assert.throws(() => inst[method]('k', 'v'), ImmutabilityError);
    assert.deepEqual(inst.getAll(), before);
  });
}

test('ImmutabilityError preserves message and is a subclass of Error', () => {
  const err = new ImmutabilityError('custom');
  assert.equal(err.message, 'custom');
  assert.equal(err.name, 'ImmutabilityError');
  assert.ok(err instanceof Error);
});
