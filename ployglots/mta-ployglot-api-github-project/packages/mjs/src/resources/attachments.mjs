import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { parseAttachmentRefs } from './attachments-parser.mjs';
import { AttachmentUploadUnavailableError, GitHubHTTPError } from '../client/errors.mjs';

export function makeAttachments(client, { resolveRef, body }) {
  function md({ url, alt = 'attachment' }, { isImage = true } = {}) {
    return `${isImage ? '!' : ''}[${alt}](${url})`;
  }

  async function list(issueRef) {
    const r = await resolveRef(issueRef);
    const issue = await client.rest('GET', `/repos/${r.owner}/${r.repo}/issues/${r.number}`);
    const out = parseAttachmentRefs(issue?.body).map(x => ({ ...x, source: 'body' }));
    const comments = await client.rest('GET', `/repos/${r.owner}/${r.repo}/issues/${r.number}/comments`);
    for (const c of comments ?? []) {
      for (const ref of parseAttachmentRefs(c.body)) {
        out.push({ ...ref, source: 'comment', commentId: c.id });
      }
    }
    return out;
  }

  async function attachExternal(issueRef, { url, alt, mode = 'body', isImage = true }) {
    const line = md({ url, alt }, { isImage });
    if (mode === 'comment') {
      const c = await body.addComment(issueRef, line);
      return { source: 'comment', commentId: c.id, url, alt };
    }
    await body.appendToBody(issueRef, line);
    return { source: 'body', url, alt };
  }

  async function upload(issueRef, { filePath, alt, mode = 'body' }) {
    const r = await resolveRef(issueRef);
    const buf = await readFile(filePath);
    const name = basename(filePath);
    const uploadsBase = client._internals?.baseUrls?.uploads ?? 'https://uploads.github.com';
    const absUrl = `${uploadsBase}/repos/${r.owner}/${r.repo}/issues/${r.number}/uploads`;

    let res;
    try {
      res = await client._internals.rawPost(absUrl, buf, {
        'content-type': 'application/octet-stream',
        'content-disposition': `attachment; filename=${JSON.stringify(name)}`,
      });
    } catch (err) {
      if (err instanceof GitHubHTTPError && err.status === 404) {
        throw new AttachmentUploadUnavailableError(
          'attachment uploads are not available on this host; host the file externally and use attachExternal',
          { filePath, host: uploadsBase },
        );
      }
      throw err;
    }
    return attachExternal(issueRef, { url: res?.asset_url ?? res?.url, alt, mode });
  }

  /**
   * Replace the first attachment URL in a comment.
   *
   * IMPORTANT: editing a comment to remove an attachment URL does NOT delete the
   * underlying file from GitHub's user-content CDN. The blob may remain accessible
   * at its original URL indefinitely. Treat all uploads as publicly disclosed.
   */
  async function replace(commentId, { newUrl, alt, repoRef }) {
    if (!repoRef?.owner || !repoRef?.repo) throw new Error('repoRef { owner, repo } required');
    const c = await client.rest('GET', `/repos/${repoRef.owner}/${repoRef.repo}/issues/comments/${commentId}`);
    const oldRefs = parseAttachmentRefs(c.body);
    let body = c.body;
    if (oldRefs.length === 0) {
      body = (body ?? '') + `\n![${alt ?? 'attachment'}](${newUrl})`;
    } else {
      body = body.replace(oldRefs[0].url, newUrl);
      if (alt !== undefined) body = body.replace(`[${oldRefs[0].alt}]`, `[${alt}]`);
    }
    return client.rest('PATCH', `/repos/${repoRef.owner}/${repoRef.repo}/issues/comments/${commentId}`, { body });
  }

  /**
   * Delete a comment containing an attachment.
   *
   * IMPORTANT: deleting a comment does NOT delete the underlying file from
   * GitHub's user-content CDN; the blob may remain accessible indefinitely.
   * Treat all uploads as publicly disclosed once posted.
   */
  async function deleteComment(commentId, { repoRef }) {
    if (!repoRef?.owner || !repoRef?.repo) throw new Error('repoRef { owner, repo } required');
    return client.rest('DELETE', `/repos/${repoRef.owner}/${repoRef.repo}/issues/comments/${commentId}`);
  }

  /**
   * Replace an attachment URL inline in the issue body.
   *
   * IMPORTANT: removing the URL does NOT delete the underlying file on
   * GitHub's user-content CDN; treat all uploads as publicly disclosed.
   */
  async function replaceInBody(issueRef, { oldUrl, newUrl, alt }) {
    return body.patchBody(issueRef, (b) => {
      if (!b.includes(oldUrl)) return b;
      let next = b.replaceAll(oldUrl, newUrl);
      if (alt !== undefined) {
        const lines = next.split('\n').map(line =>
          line.includes(newUrl)
            ? line.replace(/\[[^\]]*\]\(/, `[${alt}](`)
            : line,
        );
        next = lines.join('\n');
      }
      return next;
    });
  }

  /**
   * Strip lines containing a given URL from an issue body.
   *
   * IMPORTANT: stripping a URL does NOT delete the underlying file on
   * GitHub's user-content CDN; treat all uploads as publicly disclosed.
   */
  async function deleteFromBody(issueRef, { url }) {
    return body.patchBody(issueRef, (b) =>
      b.split('\n').filter(line => !line.includes(url)).join('\n'),
    );
  }

  return {
    list, attachExternal, upload, replace, delete: deleteComment, replaceInBody, deleteFromBody,
  };
}
