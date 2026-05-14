// @ts-nocheck
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { TRUTHY_STRINGS, resolveBool, resolveFloat, resolveInt } from '../src/index.ts';

for (const v of ['true', 'TRUE', '1', 'yes', 'Yes', 'on', 'ON']) {
  test(`resolveBool truthy: "${v}"`, () => {
    assert.strictEqual(resolveBool(v, null, null, null, false), true);
  });
}

for (const v of ['false', '0', 'no', 'off', '']) {
  test(`resolveBool falsy: "${v}"`, () => {
    assert.strictEqual(resolveBool(v, null, null, null, true), false);
  });
}

test('resolveBool zero number', () => {
  assert.strictEqual(resolveBool(0, null, null, null, true), false);
});

test('resolveBool nonzero number', () => {
  assert.strictEqual(resolveBool(42, null, null, null, false), true);
});

test('resolveInt clean string', () => {
  assert.strictEqual(resolveInt('42', null, null, null, 0), 42);
});

test('resolveInt decimal string rejected (D4)', () => {
  assert.strictEqual(resolveInt('3.14', null, null, null, 0), 0);
});

test('resolveInt bool arg rejected (D5)', () => {
  assert.strictEqual(resolveInt(true, null, null, null, 0), 0);
  assert.strictEqual(resolveInt(false, null, null, null, 99), 99);
});

test('resolveInt clean number', () => {
  assert.strictEqual(resolveInt(7, null, null, null, 0), 7);
});

test('resolveInt non-integer number rejected', () => {
  assert.strictEqual(resolveInt(1.5, null, null, null, 0), 0);
});

test('resolveFloat clean string', () => {
  assert.strictEqual(resolveFloat('3.14', null, null, null, 0), 3.14);
});

test('resolveFloat scientific notation', () => {
  assert.strictEqual(resolveFloat('1e3', null, null, null, 0), 1000);
});

test('resolveFloat partial-numeric rejected (D6)', () => {
  assert.strictEqual(resolveFloat('12abc', null, null, null, 0), 0);
});

test('resolveFloat int value', () => {
  assert.strictEqual(resolveFloat(42, null, null, null, 0), 42);
});

test('TRUTHY_STRINGS constant', () => {
  assert.deepStrictEqual([...TRUTHY_STRINGS], ['true', '1', 'yes', 'on']);
});
