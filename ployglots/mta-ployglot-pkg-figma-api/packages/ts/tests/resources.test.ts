// @ts-nocheck
/**
 * Coverage for the 5 new domain resources + the extended
 * Files/Comments endpoints. All tests mock the FetchClient so we
 * assert method + path + params + body exactly as they go over the
 * wire.
 */

import { describe, expect, it } from 'vitest';

import { FigmaClient } from '../src/index.js';
import { createFakeFetchClient } from './_helpers.js';

function okFake() {
  return createFakeFetchClient(() => ({ status: 200, body: {} }));
}

describe('ComponentsResource', () => {
  it('listForTeam hits /v1/teams/:id/components with page params', async () => {
    const fake = okFake();
    const client = new FigmaClient({ token: 't', fetchClient: fake });
    await client.components.listForTeam('42', { page_size: 100 });
    expect(fake.calls[0].method).toBe('GET');
    expect(fake.calls[0].path).toBe('/v1/teams/42/components');
    expect(fake.calls[0].options.params).toEqual({ page_size: 100 });
  });

  it('listForFile hits /v1/files/:key/components', async () => {
    const fake = okFake();
    const client = new FigmaClient({ token: 't', fetchClient: fake });
    await client.components.listForFile('FILE');
    expect(fake.calls[0].path).toBe('/v1/files/FILE/components');
  });

  it('get hits /v1/components/:key', async () => {
    const fake = okFake();
    const client = new FigmaClient({ token: 't', fetchClient: fake });
    await client.components.get('abc');
    expect(fake.calls[0].path).toBe('/v1/components/abc');
  });

  it('listStylesForTeam and getStyle hit the right paths', async () => {
    const fake = okFake();
    const client = new FigmaClient({ token: 't', fetchClient: fake });
    await client.components.listStylesForTeam('42');
    await client.components.getStyle('S');
    expect(fake.calls[0].path).toBe('/v1/teams/42/styles');
    expect(fake.calls[1].path).toBe('/v1/styles/S');
  });

  it('listComponentSetsForTeam + getComponentSet', async () => {
    const fake = okFake();
    const client = new FigmaClient({ token: 't', fetchClient: fake });
    await client.components.listComponentSetsForTeam('42');
    await client.components.getComponentSet('CS');
    expect(fake.calls[0].path).toBe('/v1/teams/42/component_sets');
    expect(fake.calls[1].path).toBe('/v1/component_sets/CS');
  });
});

describe('VariablesResource (enterprise)', () => {
  it('listLocal + listPublished + postVariables hit the right paths', async () => {
    const fake = okFake();
    const client = new FigmaClient({ token: 't', fetchClient: fake });
    await client.variables.listLocal('FILE');
    await client.variables.listPublished('FILE');
    await client.variables.postVariables('FILE', { variables: [{ id: 'v1' }] });
    expect(fake.calls[0].path).toBe('/v1/files/FILE/variables/local');
    expect(fake.calls[1].path).toBe('/v1/files/FILE/variables/published');
    expect(fake.calls[2].method).toBe('POST');
    expect(fake.calls[2].path).toBe('/v1/files/FILE/variables');
    expect(fake.calls[2].options.body).toEqual({ variables: [{ id: 'v1' }] });
  });
});

describe('DevResourcesResource', () => {
  it('list builds node_ids param when passed', async () => {
    const fake = okFake();
    const client = new FigmaClient({ token: 't', fetchClient: fake });
    await client.devResources.list('F', ['1:2', '3:4']);
    expect(fake.calls[0].path).toBe('/v1/files/F/dev_resources');
    expect(fake.calls[0].options.params).toEqual({ node_ids: '1:2,3:4' });
  });

  it('create bulk-posts under dev_resources envelope', async () => {
    const fake = okFake();
    const client = new FigmaClient({ token: 't', fetchClient: fake });
    await client.devResources.create([
      { name: 'x', url: 'https://a', file_key: 'F', node_id: '1:2' },
    ]);
    expect(fake.calls[0].method).toBe('POST');
    expect(fake.calls[0].path).toBe('/v1/dev_resources');
    expect(fake.calls[0].options.body).toEqual({
      dev_resources: [{ name: 'x', url: 'https://a', file_key: 'F', node_id: '1:2' }],
    });
  });

  it('delete hits scoped path', async () => {
    const fake = okFake();
    const client = new FigmaClient({ token: 't', fetchClient: fake });
    await client.devResources.delete('F', 'DR1');
    expect(fake.calls[0].method).toBe('DELETE');
    expect(fake.calls[0].path).toBe('/v1/files/F/dev_resources/DR1');
  });
});

describe('LibraryAnalyticsResource (enterprise)', () => {
  it('componentActions builds correct path + params', async () => {
    const fake = okFake();
    const client = new FigmaClient({ token: 't', fetchClient: fake });
    await client.libraryAnalytics.componentActions('FILE', {
      group_by: 'team',
      order: 'desc',
      start_date: '2026-01-01',
    });
    expect(fake.calls[0].path).toBe('/v1/analytics/libraries/FILE/component/actions');
    expect(fake.calls[0].options.params).toEqual({
      group_by: 'team',
      order: 'desc',
      start_date: '2026-01-01',
    });
  });

  it('all 6 endpoints route to the correct URL suffix', async () => {
    const fake = okFake();
    const client = new FigmaClient({ token: 't', fetchClient: fake });
    await client.libraryAnalytics.componentActions('FILE', { group_by: 'file' });
    await client.libraryAnalytics.componentUsages('FILE', { group_by: 'file' });
    await client.libraryAnalytics.styleActions('FILE', { group_by: 'style' });
    await client.libraryAnalytics.styleUsages('FILE', { group_by: 'style' });
    await client.libraryAnalytics.variableActions('FILE', { group_by: 'variable' });
    await client.libraryAnalytics.variableUsages('FILE', { group_by: 'variable' });
    const suffixes = fake.calls.map((c) => c.path.replace('/v1/analytics/libraries/FILE/', ''));
    expect(suffixes).toEqual([
      'component/actions',
      'component/usages',
      'style/actions',
      'style/usages',
      'variable/actions',
      'variable/usages',
    ]);
  });
});

describe('WebhooksResource (v2)', () => {
  it('create posts to /v2/webhooks', async () => {
    const fake = okFake();
    const client = new FigmaClient({ token: 't', fetchClient: fake });
    await client.webhooks.create({
      event_type: 'FILE_UPDATE',
      team_id: 'T',
      endpoint: 'https://a.example',
      passcode: 'p',
    });
    expect(fake.calls[0].method).toBe('POST');
    expect(fake.calls[0].path).toBe('/v2/webhooks');
  });

  it('get + delete + listForTeam + requests route correctly', async () => {
    const fake = okFake();
    const client = new FigmaClient({ token: 't', fetchClient: fake });
    await client.webhooks.get('W');
    await client.webhooks.delete('W');
    await client.webhooks.listForTeam('T');
    await client.webhooks.requests('W');
    expect(fake.calls.map((c) => [c.method, c.path])).toEqual([
      ['GET', '/v2/webhooks/W'],
      ['DELETE', '/v2/webhooks/W'],
      ['GET', '/v2/teams/T/webhooks'],
      ['GET', '/v2/webhooks/W/requests'],
    ]);
  });
});

describe('Files extended', () => {
  it('versions + meta + imageFills hit the right paths', async () => {
    const fake = okFake();
    const client = new FigmaClient({ token: 't', fetchClient: fake });
    await client.files.versions('F', { page_size: 10 });
    await client.files.meta('F');
    await client.files.imageFills('F');
    expect(fake.calls.map((c) => c.path)).toEqual([
      '/v1/files/F/versions',
      '/v1/files/F/meta',
      '/v1/files/F/images',
    ]);
  });
});

describe('Comments reactions', () => {
  it('list / add / remove reactions route to /reactions', async () => {
    const fake = okFake();
    const client = new FigmaClient({ token: 't', fetchClient: fake });
    await client.comments.reactions('F', 'C1');
    await client.comments.addReaction('F', 'C1', '🎉');
    await client.comments.removeReaction('F', 'C1', '🎉');
    expect(fake.calls.map((c) => [c.method, c.path])).toEqual([
      ['GET', '/v1/files/F/comments/C1/reactions'],
      ['POST', '/v1/files/F/comments/C1/reactions'],
      ['DELETE', '/v1/files/F/comments/C1/reactions'],
    ]);
    expect(fake.calls[1].options.body).toEqual({ emoji: '🎉' });
    expect(fake.calls[2].options.params).toEqual({ emoji: '🎉' });
  });
});

describe('Comments list empty-envelope fallback', () => {
  it('returns [] when the server omits the comments field', async () => {
    const fake = createFakeFetchClient(() => ({ status: 200, body: {} }));
    const client = new FigmaClient({ token: 't', fetchClient: fake });
    const comments = await client.comments.list('F');
    expect(comments).toEqual([]);
  });
});

describe('Comments CRUD', () => {
  it('create posts the full body envelope', async () => {
    const fake = okFake();
    const client = new FigmaClient({ token: 't', fetchClient: fake });
    await client.comments.create('F', { message: 'hi', client_meta: { x: 1 } });
    expect(fake.calls[0].method).toBe('POST');
    expect(fake.calls[0].path).toBe('/v1/files/F/comments');
    expect(fake.calls[0].options.body).toEqual({ message: 'hi', client_meta: { x: 1 } });
  });

  it('delete hits scoped path', async () => {
    const fake = okFake();
    const client = new FigmaClient({ token: 't', fetchClient: fake });
    await client.comments.delete('F', 'C42');
    expect(fake.calls[0].method).toBe('DELETE');
    expect(fake.calls[0].path).toBe('/v1/files/F/comments/C42');
  });
});

describe('Files untested methods', () => {
  it('nodes builds ids query', async () => {
    const fake = okFake();
    const client = new FigmaClient({ token: 't', fetchClient: fake });
    await client.files.nodes('F', ['1:2', '3:4']);
    expect(fake.calls[0].path).toBe('/v1/files/F/nodes');
    expect(fake.calls[0].options.params).toEqual({ ids: '1:2,3:4' });
  });

  it('images with format + scale passes both params', async () => {
    const fake = okFake();
    const client = new FigmaClient({ token: 't', fetchClient: fake });
    await client.files.images('F', ['1:2'], { format: 'png', scale: 2 });
    expect(fake.calls[0].path).toBe('/v1/images/F');
    expect(fake.calls[0].options.params).toEqual({ ids: '1:2', format: 'png', scale: 2 });
  });

  it('images without options still works (ids only)', async () => {
    const fake = okFake();
    const client = new FigmaClient({ token: 't', fetchClient: fake });
    await client.files.images('F', ['1:2']);
    expect(fake.calls[0].options.params).toEqual({ ids: '1:2' });
  });

  it('get with all optional params threads them through', async () => {
    const fake = okFake();
    const client = new FigmaClient({ token: 't', fetchClient: fake });
    await client.files.get('F', {
      version: 'V1',
      ids: ['1:2'],
      depth: 3,
      geometry: 'paths',
      plugin_data: 'all',
      branch_data: true,
    });
    expect(fake.calls[0].options.params).toEqual({
      version: 'V1',
      ids: '1:2',
      depth: 3,
      geometry: 'paths',
      plugin_data: 'all',
      branch_data: true,
    });
  });

  it('versions without options passes empty params', async () => {
    const fake = okFake();
    const client = new FigmaClient({ token: 't', fetchClient: fake });
    await client.files.versions('F');
    expect(fake.calls[0].path).toBe('/v1/files/F/versions');
    expect(fake.calls[0].options.params).toEqual({});
  });

  it('versions with before + after params', async () => {
    const fake = okFake();
    const client = new FigmaClient({ token: 't', fetchClient: fake });
    await client.files.versions('F', { before: 'B', after: 'A' });
    expect(fake.calls[0].options.params).toEqual({ before: 'B', after: 'A' });
  });
});

describe('Components untested', () => {
  it('listComponentSetsForFile hits /v1/files/:key/component_sets', async () => {
    const fake = okFake();
    const client = new FigmaClient({ token: 't', fetchClient: fake });
    await client.components.listComponentSetsForFile('F');
    expect(fake.calls[0].path).toBe('/v1/files/F/component_sets');
  });

  it('listStylesForFile hits /v1/files/:key/styles', async () => {
    const fake = okFake();
    const client = new FigmaClient({ token: 't', fetchClient: fake });
    await client.components.listStylesForFile('F');
    expect(fake.calls[0].path).toBe('/v1/files/F/styles');
  });

  it('page params thread through (after + before)', async () => {
    const fake = okFake();
    const client = new FigmaClient({ token: 't', fetchClient: fake });
    await client.components.listForTeam('T', { after: 'CURSOR', before: 'OTHER' });
    expect(fake.calls[0].options.params).toEqual({ after: 'CURSOR', before: 'OTHER' });
  });
});

describe('DevResources untested', () => {
  it('update posts to /v1/dev_resources with dev_resources envelope', async () => {
    const fake = okFake();
    const client = new FigmaClient({ token: 't', fetchClient: fake });
    await client.devResources.update([{ id: 'D1', name: 'new' }]);
    expect(fake.calls[0].method).toBe('POST');
    expect(fake.calls[0].path).toBe('/v1/dev_resources');
    expect(fake.calls[0].options.body).toEqual({ dev_resources: [{ id: 'D1', name: 'new' }] });
  });

  it('list without node_ids passes empty params', async () => {
    const fake = okFake();
    const client = new FigmaClient({ token: 't', fetchClient: fake });
    await client.devResources.list('F');
    expect(fake.calls[0].options.params).toEqual({});
  });
});

describe('Projects untested', () => {
  it('listFiles hits /v1/projects/:project_id/files', async () => {
    const fake = okFake();
    const client = new FigmaClient({ token: 't', fetchClient: fake });
    await client.projects.listFiles('P1');
    expect(fake.calls[0].path).toBe('/v1/projects/P1/files');
  });
});

describe('Webhooks untested', () => {
  it('update posts to /v2/webhooks/:id', async () => {
    const fake = okFake();
    const client = new FigmaClient({ token: 't', fetchClient: fake });
    await client.webhooks.update('W', { endpoint: 'https://b.example' });
    expect(fake.calls[0].method).toBe('POST');
    expect(fake.calls[0].path).toBe('/v2/webhooks/W');
    expect(fake.calls[0].options.body).toEqual({ endpoint: 'https://b.example' });
  });
});

describe('LibraryAnalytics branch coverage', () => {
  it('flatten omits optional params when undefined', async () => {
    const fake = okFake();
    const client = new FigmaClient({ token: 't', fetchClient: fake });
    await client.libraryAnalytics.componentActions('F', { group_by: 'team' });
    expect(fake.calls[0].options.params).toEqual({ group_by: 'team' });
  });

  it('flatten includes only end_date when start_date is undefined', async () => {
    const fake = okFake();
    const client = new FigmaClient({ token: 't', fetchClient: fake });
    await client.libraryAnalytics.componentActions('F', {
      group_by: 'team',
      end_date: '2026-02-01',
    });
    expect(fake.calls[0].options.params).toEqual({
      group_by: 'team',
      end_date: '2026-02-01',
    });
  });

  it('flatten includes only cursor when provided', async () => {
    const fake = okFake();
    const client = new FigmaClient({ token: 't', fetchClient: fake });
    await client.libraryAnalytics.componentActions('F', {
      group_by: 'team',
      cursor: 'C1',
    });
    expect(fake.calls[0].options.params).toEqual({ group_by: 'team', cursor: 'C1' });
  });
});

describe('Projects Team listForTeam branch coverage', () => {
  it('calls with no pagination params (all undefined)', async () => {
    const fake = okFake();
    const client = new FigmaClient({ token: 't', fetchClient: fake });
    await client.projects.listForTeam('T1');
    expect(fake.calls[0].path).toBe('/v1/teams/T1/projects');
  });
});
