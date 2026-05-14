export const VIEW_FRAGMENT = /* GraphQL */ `
  fragment ViewFields on ProjectV2View {
    id name number layout filter
    groupByFields(first: 5) { nodes { ... on ProjectV2FieldCommon { id name } } }
    sortByFields(first: 10) { nodes { field { ... on ProjectV2FieldCommon { id name } } direction } }
    fields(first: 50)       { nodes { ... on ProjectV2FieldCommon { id name } } }
  }
`;

export const LIST_VIEWS = /* GraphQL */ `
  query ListViews($projectId: ID!, $after: String) {
    node(id: $projectId) {
      ... on ProjectV2 {
        views(first: 50, after: $after) {
          nodes { ...ViewFields }
          pageInfo { hasNextPage endCursor }
        }
      }
    }
  }
  ${VIEW_FRAGMENT}
`;

export const GET_VIEW = /* GraphQL */ `
  query GetView($id: ID!) {
    node(id: $id) { ...ViewFields }
  }
  ${VIEW_FRAGMENT}
`;

// Note: at the time of writing, GitHub's GraphQL surface does not expose
// dedicated mutations for view layout, group-by, sort-by, or visible-fields
// changes — the documented updateProjectV2View covers `name` and `filter`.
export const UPDATE_VIEW = /* GraphQL */ `
  mutation UpdateView($input: UpdateProjectV2ViewInput!) {
    updateProjectV2View(input: $input) { projectV2View { ...ViewFields } }
  }
  ${VIEW_FRAGMENT}
`;
