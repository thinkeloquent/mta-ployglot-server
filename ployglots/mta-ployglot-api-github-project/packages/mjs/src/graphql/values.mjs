export const VALUE_FRAGMENT = /* GraphQL */ `
  fragment ValueFields on ProjectV2ItemFieldValue {
    __typename
    ... on ProjectV2ItemFieldTextValue   { text   field { ... on ProjectV2FieldCommon { id name } } }
    ... on ProjectV2ItemFieldNumberValue { number field { ... on ProjectV2FieldCommon { id name } } }
    ... on ProjectV2ItemFieldDateValue   { date   field { ... on ProjectV2FieldCommon { id name } } }
    ... on ProjectV2ItemFieldSingleSelectValue {
      optionId name color field { ... on ProjectV2FieldCommon { id name } }
    }
    ... on ProjectV2ItemFieldIterationValue {
      iterationId title startDate duration field { ... on ProjectV2FieldCommon { id name } }
    }
    ... on ProjectV2ItemFieldUserValue {
      users(first: 10) { nodes { id login } }
      field { ... on ProjectV2FieldCommon { id name } }
    }
    ... on ProjectV2ItemFieldRepositoryValue {
      repository { id nameWithOwner } field { ... on ProjectV2FieldCommon { id name } }
    }
    ... on ProjectV2ItemFieldMilestoneValue {
      milestone { id title } field { ... on ProjectV2FieldCommon { id name } }
    }
    ... on ProjectV2ItemFieldLabelValue {
      labels(first: 20) { nodes { id name color } } field { ... on ProjectV2FieldCommon { id name } }
    }
    ... on ProjectV2ItemFieldPullRequestValue {
      pullRequests(first: 20) { nodes { id number url state } } field { ... on ProjectV2FieldCommon { id name } }
    }
    ... on ProjectV2ItemFieldReviewerValue {
      reviewers(first: 20) { nodes { ... on User { id login } ... on Team { id slug } } } field { ... on ProjectV2FieldCommon { id name } }
    }
  }
`;

export const SET_VALUE = /* GraphQL */ `
  mutation SetValue($input: UpdateProjectV2ItemFieldValueInput!) {
    updateProjectV2ItemFieldValue(input: $input) {
      projectV2Item { id type isArchived }
    }
  }
`;

export const CLEAR_VALUE = /* GraphQL */ `
  mutation ClearValue($projectId: ID!, $itemId: ID!, $fieldId: ID!) {
    clearProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId }) {
      projectV2Item { id }
    }
  }
`;
