import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { VERSION } from '../src/index.mjs';

test('smoke: VERSION is 0.1.0', () => {
  assert.equal(VERSION, '0.1.0');
});
