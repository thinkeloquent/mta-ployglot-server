import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Security } from '../src/security.mjs';
import { SecurityError } from '../src/errors.mjs';

test('validatePath: clean path returns silently', () => {
  Security.validatePath('a.b.c');
  Security.validatePath('foo');
  Security.validatePath('');
});

test('validatePath: __proto__ throws', () => {
  assert.throws(() => Security.validatePath('a.__proto__.x'), SecurityError);
});

test('validatePath: constructor throws', () => {
  assert.throws(() => Security.validatePath('constructor'), SecurityError);
});

test('validatePath: prototype throws', () => {
  assert.throws(() => Security.validatePath('foo.prototype.bar'), SecurityError);
});
