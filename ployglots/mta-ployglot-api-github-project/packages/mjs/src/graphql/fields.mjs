export const FIELD_FRAGMENT = /* GraphQL */ `
  fragment FieldFields on ProjectV2FieldConfiguration {
    ... on ProjectV2Field {
      id name dataType createdAt updatedAt
    }
    ... on ProjectV2SingleSelectField {
      id name dataType createdAt updatedAt
      options { id name color description }
    }
    ... on ProjectV2IterationField {
      id name dataType createdAt updatedAt
      configuration {
        startDay duration
        iterations { id title startDate duration }
        completedIterations { id title startDate duration }
      }
    }
  }
`;

export const LIST_FIELDS = /* GraphQL */ `
  query ListFields($projectId: ID!, $after: String) {
    node(id: $projectId) {
      ... on ProjectV2 {
        fields(first: 100, after: $after) {
          nodes { ...FieldFields }
          pageInfo { hasNextPage endCursor }
        }
      }
    }
  }
  ${FIELD_FRAGMENT}
`;

export const GET_FIELD = /* GraphQL */ `
  query GetField($id: ID!) {
    node(id: $id) { ...FieldFields }
  }
  ${FIELD_FRAGMENT}
`;

export const CREATE_FIELD = /* GraphQL */ `
  mutation CreateField($input: CreateProjectV2FieldInput!) {
    createProjectV2Field(input: $input) {
      projectV2Field { ...FieldFields }
    }
  }
  ${FIELD_FRAGMENT}
`;

export const UPDATE_FIELD = /* GraphQL */ `
  mutation UpdateField($input: UpdateProjectV2FieldInput!) {
    updateProjectV2Field(input: $input) {
      projectV2Field { ...FieldFields }
    }
  }
  ${FIELD_FRAGMENT}
`;

export const DELETE_FIELD = /* GraphQL */ `
  mutation DeleteField($id: ID!) {
    deleteProjectV2Field(input: { fieldId: $id }) {
      projectV2Field { id }
    }
  }
`;
