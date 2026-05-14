import {
  ADD_ITEM_BY_ID,
  ADD_DRAFT,
  UPDATE_DRAFT,
  CONVERT_DRAFT,
  DELETE_ITEM,
  ARCHIVE_ITEM,
  UNARCHIVE_ITEM,
  LIST_ITEMS,
  GET_ITEM,
  GET_ITEM_TYPE,
} from '../graphql/items.mjs';
import { paginate } from '../client/paginate.mjs';
import { NotADraftError } from '../client/errors.mjs';

function normalizeValue(v) {
  switch (v.__typename) {
    case 'ProjectV2ItemFieldTextValue':         return v.text;
    case 'ProjectV2ItemFieldNumberValue':       return v.number;
    case 'ProjectV2ItemFieldDateValue':         return v.date;
    case 'ProjectV2ItemFieldSingleSelectValue': return { optionId: v.optionId, optionName: v.name, color: v.color };
    case 'ProjectV2ItemFieldIterationValue':    return { iterationId: v.iterationId, title: v.title, startDate: v.startDate, duration: v.duration };
    case 'ProjectV2ItemFieldUserValue':         return v.users?.nodes ?? [];
    case 'ProjectV2ItemFieldRepositoryValue':   return v.repository ?? null;
    case 'ProjectV2ItemFieldMilestoneValue':    return v.milestone ?? null;
    case 'ProjectV2ItemFieldLabelValue':        return v.labels?.nodes ?? [];
    case 'ProjectV2ItemFieldPullRequestValue':  return v.pullRequests?.nodes ?? [];
    case 'ProjectV2ItemFieldReviewerValue':     return v.reviewers?.nodes ?? [];
    default: return null;
  }
}

function shapeItem(node, fieldFilter) {
  const fieldValues = (node.fieldValues?.nodes ?? [])
    .filter(v => v?.field)
    .map(v => ({ fieldId: v.field.id, fieldName: v.field.name, value: normalizeValue(v) }))
    .filter(fv => !fieldFilter || fieldFilter.includes(fv.fieldName));
  return {
    id: node.id,
    type: node.type,
    isArchived: node.isArchived,
    content: node.content,
    fieldValues,
  };
}

export function makeItems(client) {
  /**
   * Add an existing Issue or PullRequest to a project. Idempotent.
   */
  async function add(projectId, contentId) {
    const data = await client.graphql(ADD_ITEM_BY_ID, { projectId, contentId });
    return data.addProjectV2ItemById.item;
  }

  async function createDraft(projectId, { title, body, assigneeIds } = {}) {
    if (!title) throw new Error('title is required');
    const data = await client.graphql(ADD_DRAFT, { projectId, title, body, assigneeIds });
    return data.addProjectV2DraftIssue.projectItem;
  }

  async function assertDraft(itemId) {
    const data = await client.graphql(GET_ITEM_TYPE, { id: itemId });
    const t = data?.node?.content?.__typename;
    if (t !== 'DraftIssue') throw new NotADraftError(`item ${itemId} is a ${t}, not a DraftIssue`);
    return data.node.content.id;
  }

  async function updateDraft(itemId, { title, body } = {}) {
    const draftId = await assertDraft(itemId);
    const data = await client.graphql(UPDATE_DRAFT, { id: draftId, title, body });
    return data.updateProjectV2DraftIssue.draftIssue;
  }

  async function deleteDraft(itemId, projectId) {
    await assertDraft(itemId);
    const data = await client.graphql(DELETE_ITEM, { projectId, itemId });
    return { deletedItemId: data.deleteProjectV2Item.deletedItemId };
  }

  async function convertDraft(itemId, repositoryId) {
    if (!repositoryId) throw new Error('repositoryId required');
    await assertDraft(itemId);
    const data = await client.graphql(CONVERT_DRAFT, { itemId, repositoryId });
    return data.convertProjectV2DraftIssueItemToIssue.item;
  }

  async function* list(projectId, { fields } = {}) {
    for await (const node of paginate(client, {
      query: LIST_ITEMS, variables: { projectId }, path: 'node.items',
    })) yield shapeItem(node, fields);
  }

  async function get(itemId) {
    const data = await client.graphql(GET_ITEM, { id: itemId });
    if (!data?.node) throw new Error(`item ${itemId} not found`);
    return shapeItem(data.node);
  }

  async function archive(projectId, itemId) {
    const data = await client.graphql(ARCHIVE_ITEM, { projectId, itemId });
    return shapeItem(data.archiveProjectV2Item.item);
  }

  async function unarchive(projectId, itemId) {
    const data = await client.graphql(UNARCHIVE_ITEM, { projectId, itemId });
    return shapeItem(data.unarchiveProjectV2Item.item);
  }

  /**
   * Removes the item from the project. The underlying Issue/PullRequest is NOT deleted.
   * Use deleteDraft for permanently deleting a draft.
   */
  async function deleteItem(projectId, itemId) {
    const data = await client.graphql(DELETE_ITEM, { projectId, itemId });
    return { deletedItemId: data.deleteProjectV2Item.deletedItemId };
  }

  return {
    add, createDraft, updateDraft, deleteDraft, convertDraft,
    list, get, archive, unarchive, delete: deleteItem,
  };
}

export { shapeItem, normalizeValue };
