import { VALUE_FRAGMENT } from './values.mjs';

export const ITEM_FIELDS = /* GraphQL */ `
  fragment ItemFields on ProjectV2Item {
    id type isArchived createdAt updatedAt
    content {
      __typename
      ... on Issue        { id number title url state }
      ... on PullRequest  { id number title url state }
      ... on DraftIssue   { id title body }
    }
  }
`;

export const ADD_ITEM_BY_ID = /* GraphQL */ `
  mutation AddItemById($projectId: ID!, $contentId: ID!) {
    addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
      item { ...ItemFields }
    }
  }
  ${ITEM_FIELDS}
`;

export const ADD_DRAFT = /* GraphQL */ `
  mutation AddDraft($projectId: ID!, $title: String!, $body: String, $assigneeIds: [ID!]) {
    addProjectV2DraftIssue(input: { projectId: $projectId, title: $title, body: $body, assigneeIds: $assigneeIds }) {
      projectItem { ...ItemFields }
    }
  }
  ${ITEM_FIELDS}
`;

export const UPDATE_DRAFT = /* GraphQL */ `
  mutation UpdateDraft($id: ID!, $title: String, $body: String) {
    updateProjectV2DraftIssue(input: { draftIssueId: $id, title: $title, body: $body }) {
      draftIssue { id title body }
    }
  }
`;

export const CONVERT_DRAFT = /* GraphQL */ `
  mutation ConvertDraft($itemId: ID!, $repositoryId: ID!) {
    convertProjectV2DraftIssueItemToIssue(input: { itemId: $itemId, repositoryId: $repositoryId }) {
      item { ...ItemFields }
    }
  }
  ${ITEM_FIELDS}
`;

export const DELETE_ITEM = /* GraphQL */ `
  mutation DeleteItem($projectId: ID!, $itemId: ID!) {
    deleteProjectV2Item(input: { projectId: $projectId, itemId: $itemId }) {
      deletedItemId
    }
  }
`;

export const ARCHIVE_ITEM = /* GraphQL */ `
  mutation ArchiveItem($projectId: ID!, $itemId: ID!) {
    archiveProjectV2Item(input: { projectId: $projectId, itemId: $itemId }) {
      item { ...ItemFields }
    }
  }
  ${ITEM_FIELDS}
`;

export const UNARCHIVE_ITEM = /* GraphQL */ `
  mutation UnarchiveItem($projectId: ID!, $itemId: ID!) {
    unarchiveProjectV2Item(input: { projectId: $projectId, itemId: $itemId }) {
      item { ...ItemFields }
    }
  }
  ${ITEM_FIELDS}
`;

export const LIST_ITEMS = /* GraphQL */ `
  query ListItems($projectId: ID!, $after: String) {
    node(id: $projectId) {
      ... on ProjectV2 {
        items(first: 50, after: $after) {
          nodes {
            ...ItemFields
            fieldValues(first: 50) { nodes { ...ValueFields } }
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    }
  }
  ${ITEM_FIELDS}
  ${VALUE_FRAGMENT}
`;

export const GET_ITEM = /* GraphQL */ `
  query GetItem($id: ID!) {
    node(id: $id) {
      ... on ProjectV2Item {
        ...ItemFields
        fieldValues(first: 50) { nodes { ...ValueFields } }
      }
    }
  }
  ${ITEM_FIELDS}
  ${VALUE_FRAGMENT}
`;

export const GET_ITEM_TYPE = /* GraphQL */ `
  query GetItemType($id: ID!) {
    node(id: $id) { ... on ProjectV2Item { id content { __typename ... on DraftIssue { id } } } }
  }
`;
