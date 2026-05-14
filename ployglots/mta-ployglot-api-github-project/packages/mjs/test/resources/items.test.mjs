import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeItems, shapeItem } from '../../src/resources/items.mjs';

function stubClient(handler) {
  const calls = [];
  return {
    calls,
    async graphql(q, v) {
      calls.push({ q, v });
      return await handler(q, v, calls.length);
    },
  };
}

test('add returns the item', async () => {
  const c = stubClient(() => ({ addProjectV2ItemById: { item: { id: 'I1' } } }));
  const i = makeItems(c);
  assert.deepEqual(await i.add('P', 'C'), { id: 'I1' });
});

test('createDraft missing title throws', async () => {
  const c = stubClient(() => ({}));
  const i = makeItems(c);
  await assert.rejects(i.createDraft('P', {}), /title is required/);
});

test('createDraft returns draft item', async () => {
  const c = stubClient(() => ({ addProjectV2DraftIssue: { projectItem: { id: 'I1', content: { __typename: 'DraftIssue' } } } }));
  const i = makeItems(c);
  const out = await i.createDraft('P', { title: 'T' });
  assert.equal(out.content.__typename, 'DraftIssue');
});

test('updateDraft on non-draft throws NotADraftError', async () => {
  const c = stubClient(() => ({ node: { id: 'I', content: { __typename: 'Issue' } } }));
  const i = makeItems(c);
  await assert.rejects(i.updateDraft('I', { title: 'T' }), (err) => err.name === 'NotADraftError');
});

test('updateDraft on draft sends draftId+title+body', async () => {
  let n = 0;
  const c = stubClient(() => {
    n++;
    if (n === 1) return { node: { id: 'I', content: { __typename: 'DraftIssue', id: 'D' } } };
    return { updateProjectV2DraftIssue: { draftIssue: { id: 'D', title: 'T', body: 'B' } } };
  });
  const i = makeItems(c);
  await i.updateDraft('I', { title: 'T', body: 'B' });
  assert.deepEqual(c.calls[1].v, { id: 'D', title: 'T', body: 'B' });
});

test('deleteDraft returns deletedItemId', async () => {
  let n = 0;
  const c = stubClient(() => {
    n++;
    if (n === 1) return { node: { id: 'I', content: { __typename: 'DraftIssue', id: 'D' } } };
    return { deleteProjectV2Item: { deletedItemId: 'I' } };
  });
  const i = makeItems(c);
  assert.deepEqual(await i.deleteDraft('I', 'P'), { deletedItemId: 'I' });
});

test('convertDraft missing repositoryId throws', async () => {
  const c = stubClient(() => ({}));
  const i = makeItems(c);
  await assert.rejects(i.convertDraft('I'), /repositoryId required/);
});

test('convertDraft on non-draft throws', async () => {
  const c = stubClient(() => ({ node: { id: 'I', content: { __typename: 'Issue' } } }));
  const i = makeItems(c);
  await assert.rejects(i.convertDraft('I', 'R'), (err) => err.name === 'NotADraftError');
});

test('convertDraft returns converted item', async () => {
  let n = 0;
  const c = stubClient(() => {
    n++;
    if (n === 1) return { node: { id: 'I', content: { __typename: 'DraftIssue', id: 'D' } } };
    return { convertProjectV2DraftIssueItemToIssue: { item: { id: 'I', content: { __typename: 'Issue' } } } };
  });
  const i = makeItems(c);
  const out = await i.convertDraft('I', 'R');
  assert.equal(out.content.__typename, 'Issue');
});

test('list paginates and shapes items', async () => {
  const pages = [
    { node: { items: { nodes: [{
      id: 'I1', type: 'ISSUE', isArchived: false,
      content: { __typename: 'Issue', id: 'C1', title: 'T1' },
      fieldValues: { nodes: [{ __typename: 'ProjectV2ItemFieldTextValue', text: 'hi', field: { id: 'F1', name: 'Notes' } }] },
    }], pageInfo: { hasNextPage: true, endCursor: 'a' } } } },
    { node: { items: { nodes: [{
      id: 'I2', type: 'ISSUE', isArchived: false, content: {}, fieldValues: { nodes: [] },
    }], pageInfo: { hasNextPage: false } } } },
  ];
  let i = 0;
  const c = stubClient(() => pages[i++]);
  const items = makeItems(c);
  const out = [];
  for await (const x of items.list('P')) out.push(x);
  assert.equal(out.length, 2);
  assert.equal(out[0].fieldValues[0].fieldName, 'Notes');
  assert.equal(out[0].fieldValues[0].value, 'hi');
});

test('list with field filter narrows fieldValues', async () => {
  const c = stubClient(() => ({ node: { items: { nodes: [{
    id: 'I1', type: 'ISSUE', isArchived: false, content: {},
    fieldValues: { nodes: [
      { __typename: 'ProjectV2ItemFieldTextValue', text: 'hi', field: { id: 'F1', name: 'Notes' } },
      { __typename: 'ProjectV2ItemFieldSingleSelectValue', optionId: 'O', name: 'Done', color: 'GREEN', field: { id: 'F2', name: 'Status' } },
    ] },
  }], pageInfo: { hasNextPage: false } } } }));
  const items = makeItems(c);
  const out = [];
  for await (const x of items.list('P', { fields: ['Status'] })) out.push(x);
  assert.equal(out[0].fieldValues.length, 1);
  assert.equal(out[0].fieldValues[0].fieldName, 'Status');
});

test('list empty project yields nothing', async () => {
  const c = stubClient(() => ({ node: { items: { nodes: [], pageInfo: { hasNextPage: false } } } }));
  const items = makeItems(c);
  const out = [];
  for await (const x of items.list('P')) out.push(x);
  assert.deepEqual(out, []);
});

test('get returns shaped item', async () => {
  const c = stubClient(() => ({ node: { id: 'I', type: 'ISSUE', isArchived: false, content: {}, fieldValues: { nodes: [] } } }));
  const i = makeItems(c);
  assert.equal((await i.get('I')).id, 'I');
});

test('get on missing throws', async () => {
  const c = stubClient(() => ({ node: null }));
  const i = makeItems(c);
  await assert.rejects(i.get('I'), /not found/);
});

test('archive returns shaped item with isArchived true', async () => {
  const c = stubClient(() => ({ archiveProjectV2Item: { item: { id: 'I', type: 'ISSUE', isArchived: true, content: {}, fieldValues: { nodes: [] } } } }));
  const i = makeItems(c);
  assert.equal((await i.archive('P', 'I')).isArchived, true);
});

test('unarchive returns shaped item with isArchived false', async () => {
  const c = stubClient(() => ({ unarchiveProjectV2Item: { item: { id: 'I', type: 'ISSUE', isArchived: false, content: {}, fieldValues: { nodes: [] } } } }));
  const i = makeItems(c);
  assert.equal((await i.unarchive('P', 'I')).isArchived, false);
});

test('delete returns deletedItemId', async () => {
  const c = stubClient(() => ({ deleteProjectV2Item: { deletedItemId: 'I' } }));
  const i = makeItems(c);
  assert.deepEqual(await i.delete('P', 'I'), { deletedItemId: 'I' });
});

test('shapeItem normalizes user-value', () => {
  const node = {
    id: 'I', type: 'ISSUE', isArchived: false, content: {},
    fieldValues: { nodes: [{ __typename: 'ProjectV2ItemFieldUserValue', users: { nodes: [{ id: 'U1', login: 'rob' }] }, field: { id: 'F', name: 'Owners' } }] },
  };
  const out = shapeItem(node);
  assert.deepEqual(out.fieldValues[0].value, [{ id: 'U1', login: 'rob' }]);
});
