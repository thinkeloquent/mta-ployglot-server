import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildValueInput } from '../../src/resources/values-dispatch.mjs';

test('TEXT happy', () => assert.deepEqual(buildValueInput('TEXT', 'hi'), { text: 'hi' }));
test('TEXT invalid', () => assert.throws(() => buildValueInput('TEXT', 5), /TEXT value must be a string/));

test('NUMBER happy', () => assert.deepEqual(buildValueInput('NUMBER', 7), { number: 7 }));
test('NUMBER invalid', () => assert.throws(() => buildValueInput('NUMBER', '7'), /NUMBER value must be a number/));

test('DATE happy', () => assert.deepEqual(buildValueInput('DATE', '2026-04-21'), { date: '2026-04-21' }));
test('DATE invalid', () => assert.throws(() => buildValueInput('DATE', '04/21/2026'), /ISO YYYY-MM-DD/));

test('SINGLE_SELECT happy', () => assert.deepEqual(buildValueInput('SINGLE_SELECT', 'OPT_id'), { singleSelectOptionId: 'OPT_id' }));
test('SINGLE_SELECT invalid', () => assert.throws(() => buildValueInput('SINGLE_SELECT', 5), /SINGLE_SELECT value must be option id/));

test('ITERATION accepts string', () => assert.deepEqual(buildValueInput('ITERATION', 'IT_1'), { iterationId: 'IT_1' }));
test('ITERATION accepts object', () => assert.deepEqual(buildValueInput('ITERATION', { iterationId: 'IT_2' }), { iterationId: 'IT_2' }));
test('ITERATION invalid', () => assert.throws(() => buildValueInput('ITERATION', 5), /ITERATION value must be/));

test('unknown dataType throws', () => assert.throws(() => buildValueInput('SLOTH', 'x'), /unsupported dataType/));
