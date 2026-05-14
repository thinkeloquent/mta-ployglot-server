import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeAttachments } from '../../src/resources/attachments.mjs';

function buildClient(handlers = {}) {
  const calls = [];
  return {
    calls,
    async rest(method, path, body) {
      calls.push({ method, path, body });
      return await (handlers.rest ?? (() => null))(method, path, body, calls.length);
    },
    _internals: {
      baseUrls: { uploads: 'https://uploads.github.com' },
      rawPost: async (...a) => (handlers.rawPost ?? (() => ({ asset_url: 'https://github.com/user-attachments/x' })))(...a),
    },
  };
}

const refResolver = async () => ({ owner: 'o', repo: 'r', number: 7, nodeId: 'I', databaseId: 1 });
const bodyHelpers = (client, resolveRef) => ({
  async appendToBody(ref, suffix) {
    const r = await resolveRef(ref);
    return client.rest('PATCH', `/repos/${r.owner}/${r.repo}/issues/${r.number}`, { body: suffix });
  },
  async addComment(ref, body) {
    const r = await resolveRef(ref);
    return client.rest('POST', `/repos/${r.owner}/${r.repo}/issues/${r.number}/comments`, { body });
  },
  async patchBody(ref, mutator) {
    const r = await resolveRef(ref);
    const issue = await client.rest('GET', `/repos/${r.owner}/${r.repo}/issues/${r.number}`);
    return client.rest('PATCH', `/repos/${r.owner}/${r.repo}/issues/${r.number}`, { body: mutator(issue.body ?? '') });
  },
});

test('list returns body refs and comment refs', async () => {
  const c = buildClient({
    rest: (method, path) => {
      if (method === 'GET' && /\/issues\/7$/.test(path)) return { body: '![logo](https://x.com/a.png)' };
      if (method === 'GET' && /comments$/.test(path)) return [{ id: 100, body: '[file](https://github.com/user-attachments/abc)' }];
      return null;
    },
  });
  const a = makeAttachments(c, { resolveRef: refResolver, body: bodyHelpers(c, refResolver) });
  const out = await a.list({ owner: 'o', repo: 'r', number: 7 });
  assert.equal(out.length, 2);
  assert.equal(out[0].source, 'body');
  assert.equal(out[1].source, 'comment');
  assert.equal(out[1].commentId, 100);
});

test('attachExternal body mode appends markdown', async () => {
  const c = buildClient({ rest: () => ({ id: 1 }) });
  const a = makeAttachments(c, { resolveRef: refResolver, body: bodyHelpers(c, refResolver) });
  const out = await a.attachExternal({ owner: 'o', repo: 'r', number: 7 }, { url: 'https://x/a.png', alt: 'pic' });
  assert.equal(out.source, 'body');
  const patch = c.calls.find(x => x.method === 'PATCH');
  assert.equal(patch.body.body, '![pic](https://x/a.png)');
});

test('attachExternal comment mode posts comment with id', async () => {
  const c = buildClient({ rest: () => ({ id: 555 }) });
  const a = makeAttachments(c, { resolveRef: refResolver, body: bodyHelpers(c, refResolver) });
  const out = await a.attachExternal({ owner: 'o', repo: 'r', number: 7 }, { url: 'https://x/a.png', alt: 'pic', mode: 'comment' });
  assert.deepEqual(out, { source: 'comment', commentId: 555, url: 'https://x/a.png', alt: 'pic' });
});

test('upload 404 throws AttachmentUploadUnavailableError', async () => {
  const { GitHubHTTPError } = await import('../../src/client/errors.mjs');
  const tmp = join(tmpdir(), `attach-test-${Date.now()}.txt`);
  await writeFile(tmp, 'hello');
  try {
    const c = buildClient({
      rest: () => null,
      rawPost: () => { throw new GitHubHTTPError({ status: 404, body: 'not found' }); },
    });
    const a = makeAttachments(c, { resolveRef: refResolver, body: bodyHelpers(c, refResolver) });
    await assert.rejects(a.upload({ owner: 'o', repo: 'r', number: 7 }, { filePath: tmp, alt: 'x' }),
      (err) => err.name === 'AttachmentUploadUnavailableError');
  } finally {
    await unlink(tmp);
  }
});

test('upload happy path posts attachExternal with returned URL', async () => {
  const tmp = join(tmpdir(), `attach-test-${Date.now()}.txt`);
  await writeFile(tmp, 'hello');
  try {
    const c = buildClient({
      rest: (method) => method === 'PATCH' ? { id: 1 } : null,
      rawPost: () => ({ asset_url: 'https://github.com/user-attachments/abc' }),
    });
    const a = makeAttachments(c, { resolveRef: refResolver, body: bodyHelpers(c, refResolver) });
    const out = await a.upload({ owner: 'o', repo: 'r', number: 7 }, { filePath: tmp, alt: 'doc' });
    assert.equal(out.url, 'https://github.com/user-attachments/abc');
  } finally {
    await unlink(tmp);
  }
});

test('replace swaps first attachment URL in comment body', async () => {
  const c = buildClient({
    rest: (method) => method === 'GET' ? { body: 'pre ![old](https://x/a.png) post' } : null,
  });
  const a = makeAttachments(c, { resolveRef: refResolver, body: bodyHelpers(c, refResolver) });
  await a.replace(123, { newUrl: 'https://x/b.png', repoRef: { owner: 'o', repo: 'r' } });
  const patch = c.calls.find(x => x.method === 'PATCH');
  assert.match(patch.body.body, /b\.png/);
  assert.doesNotMatch(patch.body.body, /a\.png/);
});

test('replace appends new ref when none present', async () => {
  const c = buildClient({
    rest: (method) => method === 'GET' ? { body: 'no images here' } : null,
  });
  const a = makeAttachments(c, { resolveRef: refResolver, body: bodyHelpers(c, refResolver) });
  await a.replace(123, { newUrl: 'https://x/c.png', alt: 'foo', repoRef: { owner: 'o', repo: 'r' } });
  const patch = c.calls.find(x => x.method === 'PATCH');
  assert.match(patch.body.body, /!\[foo\]\(https:\/\/x\/c\.png\)/);
});

test('delete (comment) DELETEs the right path', async () => {
  const c = buildClient({ rest: () => null });
  const a = makeAttachments(c, { resolveRef: refResolver, body: bodyHelpers(c, refResolver) });
  await a.delete(99, { repoRef: { owner: 'o', repo: 'r' } });
  const del = c.calls.find(x => x.method === 'DELETE');
  assert.equal(del.path, '/repos/o/r/issues/comments/99');
});

test('replaceInBody swaps URL in body', async () => {
  const c = buildClient({
    rest: (method) => method === 'GET' ? { body: 'see ![old](https://x/a.png)' } : null,
  });
  const a = makeAttachments(c, { resolveRef: refResolver, body: bodyHelpers(c, refResolver) });
  await a.replaceInBody({ owner: 'o', repo: 'r', number: 7 }, { oldUrl: 'https://x/a.png', newUrl: 'https://x/b.png', alt: 'new' });
  const patch = c.calls.find(x => x.method === 'PATCH');
  assert.match(patch.body.body, /!\[new\]\(https:\/\/x\/b\.png\)/);
});

test('deleteFromBody strips lines containing URL', async () => {
  const c = buildClient({
    rest: (method) => method === 'GET' ? { body: 'first\n![x](https://x/a.png)\nlast' } : null,
  });
  const a = makeAttachments(c, { resolveRef: refResolver, body: bodyHelpers(c, refResolver) });
  await a.deleteFromBody({ owner: 'o', repo: 'r', number: 7 }, { url: 'https://x/a.png' });
  const patch = c.calls.find(x => x.method === 'PATCH');
  assert.equal(patch.body.body, 'first\nlast');
});
