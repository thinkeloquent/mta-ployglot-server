import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { ConfigError } from '../src/errors.mjs';

test('ConfigError: extends Error, name set, fields populated', () => {
  const e = new ConfigError('boom', 'svc1', ['a', 'b']);
  assert.ok(e instanceof Error);
  assert.equal(e.name, 'ConfigError');
  assert.equal(e.message, 'boom');
  assert.equal(e.serviceId, 'svc1');
  assert.deepEqual(e.available, ['a', 'b']);
});

test('ConfigError: defaults serviceId=null, available=[]', () => {
  const e = new ConfigError('boom');
  assert.equal(e.serviceId, null);
  assert.deepEqual(e.available, []);
});
