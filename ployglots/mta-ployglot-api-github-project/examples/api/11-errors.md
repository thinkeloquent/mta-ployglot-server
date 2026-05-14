# API Example: Errors

## Goal

Stable error hierarchy for catch-by-class and catch-by-code. Every failure thrown by the SDK extends `GitHubError`.

## Hierarchy

```
GitHubError (base; .status?, .cause?)
├── GitHubAuthError              (401; .responseBody)
├── GitHubGraphQLError           (.errors[]; thrown when response has errors[])
├── GitHubHTTPError              (any non-2xx not handled by Auth; .responseBody)
├── RateLimitError               (.kind: 'primary' | 'secondary'; .resetAt: Date | null)
├── ConfigurationError           (invalid proxy URL, etc. — thrown synchronously)
├── ValidationError              (client-side input rejection)
├── BuiltInFieldError            (code: 'BUILT_IN_FIELD')
├── FieldNotWritableError        (code: 'FIELD_NOT_WRITABLE')
├── FieldOptionNotFoundError     (code: 'FIELD_OPTION_NOT_FOUND'; .available: string[])
├── NotADraftError               (code: 'NOT_A_DRAFT')
├── ViewOperationUnsupportedError (code: 'VIEW_MUTATION_UNAVAILABLE'; .docLink, .op | .unsupported)
└── AttachmentUploadUnavailableError (code: 'ATTACHMENT_UPLOAD_UNAVAILABLE')
```

## Stable `.code` values

| Code                              | Source class                       | Meaning                                                       |
| --------------------------------- | ---------------------------------- | ------------------------------------------------------------- |
| `'BUILT_IN_FIELD'`                | `BuiltInFieldError`                | Tried to update/delete a built-in field.                      |
| `'FIELD_NOT_WRITABLE'`            | `FieldNotWritableError`            | Tried to set a value on a read-only built-in (Title, etc.).   |
| `'FIELD_OPTION_NOT_FOUND'`        | `FieldOptionNotFoundError`         | SINGLE_SELECT name didn't match any option.                   |
| `'NOT_A_DRAFT'`                   | `NotADraftError`                   | Draft-only op called on an Issue/PR-backed item.              |
| `'VIEW_MUTATION_UNAVAILABLE'`     | `ViewOperationUnsupportedError`    | View op the GraphQL surface doesn't expose.                   |
| `'ATTACHMENT_UPLOAD_UNAVAILABLE'` | `AttachmentUploadUnavailableError` | Host has no user-content upload endpoint; use `attachExternal`. |

## Example: catch-by-class

```js
import { GitHubGraphQLError, RateLimitError, FieldOptionNotFoundError } from '@mta/github-projects';

try {
  await client.values.set(projectId, itemId, statusFieldId, 'Doneish');
} catch (err) {
  if (err instanceof FieldOptionNotFoundError) {
    console.error(`No such option. Try: ${err.available.join(', ')}`);
  } else if (err instanceof RateLimitError) {
    console.error(`Rate limited (${err.kind}); resets at ${err.resetAt}`);
  } else if (err instanceof GitHubGraphQLError) {
    console.error('GraphQL error:', err.errors.map(e => e.message).join('; '));
  } else {
    throw err;
  }
}
```

## Example: catch-by-code

```js
try {
  await client.fields.delete('PVTF_status');   // built-in
} catch (err) {
  if (err.code === 'BUILT_IN_FIELD') {
    console.warn(`Cannot delete built-in field: ${err.message}`);
  } else throw err;
}
```

## Notes

- 5xx responses and rate-limit conditions are retried automatically by `withRetry` (default 3 attempts, 250ms base, ±20% jitter). Only the **final** failure surfaces.
- `RateLimitError` honors `x-ratelimit-reset` for the `'primary'` kind; `'secondary'` falls back to exponential backoff.
- `ConfigurationError` is the only error thrown **synchronously** from `createClient`.
- All resource-specific errors carry a `.code` field for stable downstream switching, independent of class identity (useful when the SDK is bundled and `instanceof` becomes unreliable across realms).
