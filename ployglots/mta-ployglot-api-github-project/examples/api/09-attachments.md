# API Example: client.attachments

## Goal

Manage file attachments via the only path GitHub supports: embedded markdown references (`![alt](url)` / `[name](url)`) inside an issue body or comment.

## Signature / Contract

```ts
type IssueRef = string | { owner: string, repo: string, number: number };
type RepoRef = { owner: string, repo: string };

client.attachments = {
  list(issueRef: IssueRef): Promise<Array<{
    url: string, alt: string, isImage: boolean, source: 'body' | 'comment', commentId?: number
  }>>,
  attachExternal(issueRef: IssueRef, opts: {
    url: string, alt?: string, mode?: 'body' | 'comment', isImage?: boolean
  }): Promise<{ source, url, alt, commentId? }>,
  upload(issueRef: IssueRef, opts: {
    filePath: string, alt?: string, mode?: 'body' | 'comment'
  }): Promise<unknown>,
  replace(commentId: number, opts: { newUrl: string, alt?: string, repoRef: RepoRef }): Promise<unknown>,
  delete(commentId: number, opts: { repoRef: RepoRef }): Promise<unknown>,
  replaceInBody(issueRef: IssueRef, opts: { oldUrl: string, newUrl: string, alt?: string }): Promise<unknown>,
  deleteFromBody(issueRef: IssueRef, opts: { url: string }): Promise<unknown>,
}
```

## Errors / Failure modes

| Condition                                              | Surface                                                  |
| ------------------------------------------------------ | -------------------------------------------------------- |
| `upload` endpoint returns 404 (older GHES, no upload)  | `AttachmentUploadUnavailableError` (`code: 'ATTACHMENT_UPLOAD_UNAVAILABLE'`) — fall back to `attachExternal` |
| `replace` / `delete` without `repoRef`                 | `Error('repoRef { owner, repo } required')`              |

## Example

```js
const ref = { owner: 'acme', repo: 'platform', number: 42 };

// External URL → body
await client.attachments.attachExternal(ref, { url: 'https://cdn.acme/logo.png', alt: 'logo' });

// External URL → new comment
const a = await client.attachments.attachExternal(ref, { url: 'https://cdn.acme/spec.pdf', alt: 'spec', mode: 'comment' });
// a → { source: 'comment', commentId: 12345, url: '...', alt: 'spec' }

// Read all attachments on the issue
const all = await client.attachments.list(ref);

// Replace in the comment we just made
await client.attachments.replace(a.commentId, {
  newUrl: 'https://cdn.acme/spec-v2.pdf',
  alt: 'spec (v2)',
  repoRef: { owner: 'acme', repo: 'platform' },
});

// Delete the comment entirely
await client.attachments.delete(a.commentId, { repoRef: { owner: 'acme', repo: 'platform' } });
```

## Notes

- **CDN persistence:** deleting a comment or stripping a URL does NOT delete the underlying file from GitHub's user-content CDN. The blob may remain accessible at its original URL indefinitely. **Treat all uploads as publicly disclosed once posted.**
- `upload` requires the host to expose the user-content upload endpoint; many GHES versions don't. Always handle `AttachmentUploadUnavailableError` and fall back to `attachExternal`.
- Attachments are NOT a Projects v2 concept — they live on issues. The functions take `issueRef`, not `itemId`.
- Markdown parsing uses a small regex matching `![alt](url)` / `[name](url)`; full CommonMark parsing is out of scope.
