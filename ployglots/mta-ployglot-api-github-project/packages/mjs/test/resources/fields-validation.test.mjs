import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateCreateInput } from '../../src/resources/fields-validation.mjs';

test('missing name throws', () => {
  assert.throws(() => validateCreateInput({ dataType: 'TEXT' }), /name is required/);
});

test('invalid dataType throws', () => {
  assert.throws(() => validateCreateInput({ name: 'x', dataType: 'OOPS' }), /dataType must be one of/);
});

test('SINGLE_SELECT without options throws', () => {
  assert.throws(() => validateCreateInput({ name: 'x', dataType: 'SINGLE_SELECT' }), /SINGLE_SELECT requires/);
});

test('SINGLE_SELECT with empty options throws', () => {
  assert.throws(() => validateCreateInput({ name: 'x', dataType: 'SINGLE_SELECT', singleSelectOptions: [] }), /SINGLE_SELECT requires/);
});

test('SINGLE_SELECT option missing name throws', () => {
  assert.throws(
    () => validateCreateInput({ name: 'x', dataType: 'SINGLE_SELECT', singleSelectOptions: [{}] }),
    /every option needs a name/,
  );
});

test('SINGLE_SELECT invalid color throws', () => {
  assert.throws(
    () => validateCreateInput({ name: 'x', dataType: 'SINGLE_SELECT', singleSelectOptions: [{ name: 'a', color: 'CHARTREUSE' }] }),
    /invalid color/,
  );
});

test('ITERATION without configuration throws', () => {
  assert.throws(() => validateCreateInput({ name: 'x', dataType: 'ITERATION' }), /ITERATION requires/);
});

test('ITERATION with partial configuration throws', () => {
  assert.throws(
    () => validateCreateInput({ name: 'x', dataType: 'ITERATION', iterationConfiguration: { duration: 14 } }),
    /ITERATION requires/,
  );
});

test('TEXT passes silently', () => {
  validateCreateInput({ name: 'x', dataType: 'TEXT' });
});

test('SINGLE_SELECT with valid options passes', () => {
  validateCreateInput({ name: 'x', dataType: 'SINGLE_SELECT', singleSelectOptions: [{ name: 'A', color: 'BLUE' }] });
});

test('ITERATION with valid configuration passes', () => {
  validateCreateInput({ name: 'x', dataType: 'ITERATION', iterationConfiguration: { startDate: '2026-04-01', duration: 14 } });
});
