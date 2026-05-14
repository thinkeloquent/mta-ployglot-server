# SDK Example: Custom HOST + proxy configuration

## Goal

Construct a client that targets **GitHub Enterprise Server** through a corporate **HTTP proxy**, then make a smoke-check GraphQL call.

## Prerequisites

- `GHES_TOKEN` — a PAT issued by the Enterprise Server instance.
- `GHES_HOST` — the Enterprise Server hostname (e.g. `github.acme.corp`).
- `HTTPS_PROXY` — a forward proxy URL (e.g. `http://proxy.acme.corp:3128`).

## Code

```js
import { createClient } from '@mta/github-projects';

const client = createClient({
  token: process.env.GHES_TOKEN,
  host: process.env.GHES_HOST,        // bare hostname or full https://... — both accepted
  proxy: process.env.HTTPS_PROXY,     // ProxyAgent constructed once and reused
});

// Inspect the resolved URLs (no network call).
console.log(client._internals.baseUrls);
//   { graphql: 'https://github.acme.corp/api/graphql',
//     rest:    'https://github.acme.corp/api/v3',
//     uploads: 'https://github.acme.corp/api/uploads' }

// Smoke-check call.
const data = await client.graphql('query { viewer { login } }');
console.log('viewer:', data.viewer.login);

// When done, release the proxy connection pool so the process can exit.
if (client._internals.dispatcher) await client._internals.dispatcher.close();
```

## Expected outcome

```
{
  graphql: 'https://github.acme.corp/api/graphql',
  rest: 'https://github.acme.corp/api/v3',
  uploads: 'https://github.acme.corp/api/uploads'
}
viewer: rcmarte
```

## Notes

- The default host (`api.github.com`) uses host-based routing; Enterprise uses path-based (`/api/graphql`, `/api/v3`). The SDK switches transparently via `resolveBaseUrls(host)`.
- The proxy URL accepts basic auth (`http://user:pass@proxy.acme.corp:3128`).
- Invalid proxy URLs throw `ConfigurationError` at `createClient` time, not at first request.
- For HTTPS-only deployments behind a CONNECT-style proxy, the same `proxy` option works — undici's `ProxyAgent` issues `CONNECT` automatically for `https://` origins.
