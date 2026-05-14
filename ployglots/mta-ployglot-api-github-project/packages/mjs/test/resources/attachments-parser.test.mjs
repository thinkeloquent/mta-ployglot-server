import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAttachmentRefs } from '../../src/resources/attachments-parser.mjs';

test('image with media extension matched', () => {
  const out = parseAttachmentRefs('![logo](https://x.com/a.png)');
  assert.equal(out.length, 1);
  assert.equal(out[0].isImage, true);
});

test('user-attachments link matched even without extension', () => {
  const out = parseAttachmentRefs('[logs](https://github.com/user-attachments/abc)');
  assert.equal(out.length, 1);
  assert.equal(out[0].isImage, false);
});

test('plain inline link not matched', () => {
  assert.equal(parseAttachmentRefs('[docs](https://example.com)').length, 0);
});

test('multiple refs in one body', () => {
  const out = parseAttachmentRefs('see ![a](https://x/a.png) and [b](https://github.com/user-attachments/123)');
  assert.equal(out.length, 2);
});

test('empty/undefined returns []', () => {
  assert.deepEqual(parseAttachmentRefs(''), []);
  assert.deepEqual(parseAttachmentRefs(undefined), []);
});
