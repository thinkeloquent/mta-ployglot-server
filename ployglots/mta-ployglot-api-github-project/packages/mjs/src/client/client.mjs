import { transport } from './transport.mjs';
import { makeAuth } from './auth.mjs';
import { resolveBaseUrls } from './urls.mjs';
import { createProxyDispatcher } from './proxy.mjs';
import { withRetry } from './retry.mjs';
import {
  GitHubAuthError,
  GitHubGraphQLError,
  GitHubHTTPError,
} from './errors.mjs';
import { version } from '../version.mjs';
import { makeProjects } from '../resources/projects.mjs';
import { makeFields } from '../resources/fields.mjs';
import { makeItems } from '../resources/items.mjs';
import { makeValues } from '../resources/field-values.mjs';
import { makeViews } from '../resources/views.mjs';
import { makeAccess } from '../resources/access.mjs';
import { makeRelationships } from '../resources/relationships.mjs';
import { makeAttachments } from '../resources/attachments.mjs';
import { makeBodyHelpers } from '../resources/relationships-body.mjs';
import { makeIssueRefResolver } from '../resources/relationships-issueref.mjs';
import { makeBulk } from '../bulk/index.mjs';

export function createClient({ token, host, proxy, retry, fetch: customFetch } = {}) {
  if (!token) throw new Error('token is required');
  const auth = makeAuth(token);
  const userAgent = `mta-github-projects/${version}`;
  const baseUrls = resolveBaseUrls(host);
  const dispatcher = proxy ? createProxyDispatcher(proxy) : undefined;

  async function graphql(query, variables = {}, options = {}) {
    const headers = {
      'authorization': await auth(),
      'user-agent': userAgent,
      'content-type': 'application/json',
      'accept': 'application/vnd.github+json',
      ...options.headers,
    };
    const res = await withRetry(() => transport({
      url: baseUrls.graphql,
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
      signal: options.signal,
      dispatcher,
      fetch: customFetch,
    }), retry);
    if (res.status === 401) throw new GitHubAuthError(res);
    if (res.status >= 400) throw new GitHubHTTPError(res);
    if (Array.isArray(res.body?.errors) && res.body.errors.length > 0) {
      const msg = res.body.errors.map(e => e.message).join('; ');
      throw new GitHubGraphQLError(msg, { errors: res.body.errors, status: res.status });
    }
    return res.body?.data;
  }

  async function rest(method, path, body, options = {}) {
    const headers = {
      'authorization': await auth(),
      'user-agent': userAgent,
      'accept': 'application/vnd.github+json',
      ...(body !== undefined && body !== null ? { 'content-type': 'application/json' } : {}),
      ...options.headers,
    };
    const res = await withRetry(() => transport({
      url: baseUrls.rest + path,
      method,
      headers,
      body: body !== undefined && body !== null ? JSON.stringify(body) : undefined,
      signal: options.signal,
      dispatcher,
      fetch: customFetch,
    }), retry);
    if (res.status === 401) throw new GitHubAuthError(res);
    if (res.status >= 400) throw new GitHubHTTPError(res);
    return res.status === 204 ? null : res.body;
  }

  async function rawPost(absoluteUrl, body, extraHeaders = {}) {
    const headers = {
      'authorization': await auth(),
      'user-agent': userAgent,
      'accept': 'application/vnd.github+json',
      ...extraHeaders,
    };
    const res = await withRetry(() => transport({
      url: absoluteUrl, method: 'POST', headers, body, dispatcher, fetch: customFetch,
    }), retry);
    if (res.status === 401) throw new GitHubAuthError(res);
    if (res.status >= 400) throw new GitHubHTTPError(res);
    return res.body;
  }

  const api = { graphql, rest };
  api.projects = makeProjects(api);
  api.fields = makeFields(api);
  api.items = makeItems(api);
  api.values = makeValues(api, { items: api.items, fields: api.fields });
  api.views = makeViews(api);
  api.access = makeAccess(api);
  api.relations = makeRelationships(api, { fields: api.fields, items: api.items, values: api.values });
  const resolveRef = makeIssueRefResolver(api);
  const bodyHelpers = makeBodyHelpers(api, resolveRef);
  api._internals = { baseUrls, dispatcher, rawPost };
  api.attachments = makeAttachments(api, { resolveRef, body: bodyHelpers });
  api.bulk = makeBulk(api, { values: api.values, items: api.items, relations: api.relations });
  return api;
}
