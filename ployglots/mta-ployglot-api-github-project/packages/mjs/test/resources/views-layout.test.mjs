import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toLayoutName, toLayoutEnum } from '../../src/resources/views-layout.mjs';

test('TABLE_LAYOUT → table', () => assert.equal(toLayoutName('TABLE_LAYOUT'), 'table'));
test('board → BOARD_LAYOUT', () => assert.equal(toLayoutEnum('board'), 'BOARD_LAYOUT'));
test('unknown name passes through', () => assert.equal(toLayoutName('FOO'), 'FOO'));
test('unknown friendly passes through', () => assert.equal(toLayoutEnum('foo'), 'foo'));
