# API Example: createClient

## Goal

Construct a configured `Client` exposing `graphql`, `rest`, and the resource namespaces (`projects`, `fields`, `items`, `values`, `views`, `access`, `relations`, `attachments`, `bulk`).

## Signature / Contract

```ts
type TokenInput = string | (() => string | Promise<string>);

function createClient(config: {
  token: TokenInput;            // required
  host?: string;                // bare hostname or full https URL
  proxy?: string;               // http(s)://[user:pass@]host:port
  retry?: { maxAttempts?: number; baseDelayMs?: number };
  fetch?: typeof globalThis.fetch;
}): Client;
```

## Inputs

| Name      | Type                | Required | Description                                                |
| --------- | ------------------- | -------- | ---------------------------------------------------------- |
| `token`   | `TokenInput`        | yes      | PAT string, or async fn returning one (for refresh flows). |
| `host`    | `string`            | no       | Defaults to `api.github.com`. GHES uses path-based routing. |
| `proxy`   | `string`            | no       | Constructs an `undici.ProxyAgent`; reused across calls.    |
| `retry`   | `object`            | no       | Defaults to `{ maxAttempts: 3, baseDelayMs: 250 }`.        |
| `fetch`   | `fetch`             | no       | Inject for tests; defaults to `globalThis.fetch`.          |

## Outputs

A `Client` object:

```ts
{
  graphql(query: string, variables?: object, options?: { signal?: AbortSignal, headers?: object }): Promise<unknown>,
  rest(method: string, path: string, body?: unknown, options?: { signal?: AbortSignal, headers?: object }): Promise<unknown>,
  projects: ReturnType<typeof makeProjects>,
  fields:   ReturnType<typeof makeFields>,
  items:    ReturnType<typeof makeItems>,
  values:   ReturnType<typeof makeValues>,
  views:    ReturnType<typeof makeViews>,
  access:   ReturnType<typeof makeAccess>,
  relations: ReturnType<typeof makeRelationships>,
  attachments: ReturnType<typeof makeAttachments>,
  bulk:     ReturnType<typeof makeBulk>,
  _internals: { baseUrls, dispatcher, rawPost },
}
```

## Errors / Failure modes

| Condition                    | Surface                                                |
| ---------------------------- | ------------------------------------------------------ |
| Missing `token`              | `Error('token is required')` thrown synchronously      |
| Invalid proxy URL            | `ConfigurationError` thrown synchronously              |
| Token type not string/fn     | `Error('token must be a string or a function')`        |

## Example

```js
import { createClient } from '@mta/github-projects';

const client = createClient({
  token: process.env.GITHUB_TOKEN,
  host: 'github.acme.corp',
  proxy: 'http://proxy.acme.corp:3128',
});

const me = await client.graphql('query { viewer { login } }');
console.log(me.viewer.login);
```

## Notes

- `_internals` is exposed for testability and resource cleanup (e.g. `await client._internals.dispatcher.close()`); treat as semi-public.
- `retry` policy is applied uniformly to both `graphql` and `rest` calls.
