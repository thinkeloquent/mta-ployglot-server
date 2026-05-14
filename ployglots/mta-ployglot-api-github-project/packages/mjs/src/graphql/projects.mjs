const PROJECT_FIELDS = `
  id number title url closed public
  shortDescription readme
  owner { __typename ... on Organization { login } ... on User { login } }
  createdAt updatedAt
`;

export const GET_PROJECT_BY_OWNER_NUMBER = /* GraphQL */ `
  query GetProject($owner: String!, $number: Int!) {
    organization(login: $owner) { projectV2(number: $number) { ${PROJECT_FIELDS} } }
    user(login: $owner)         { projectV2(number: $number) { ${PROJECT_FIELDS} } }
  }
`;

export const GET_PROJECT_BY_ID = /* GraphQL */ `
  query GetProjectById($id: ID!) {
    node(id: $id) { ... on ProjectV2 { ${PROJECT_FIELDS} } }
  }
`;

export const LIST_ORG_PROJECTS = /* GraphQL */ `
  query ListOrgProjects($owner: String!, $after: String) {
    organization(login: $owner) {
      projectsV2(first: 100, after: $after) {
        nodes { ${PROJECT_FIELDS} }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

export const LIST_USER_PROJECTS = /* GraphQL */ `
  query ListUserProjects($owner: String!, $after: String) {
    user(login: $owner) {
      projectsV2(first: 100, after: $after) {
        nodes { ${PROJECT_FIELDS} }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

export const CREATE_PROJECT = /* GraphQL */ `
  mutation CreateProject($input: CreateProjectV2Input!) {
    createProjectV2(input: $input) {
      projectV2 { ${PROJECT_FIELDS} }
    }
  }
`;

export const UPDATE_PROJECT = /* GraphQL */ `
  mutation UpdateProject($input: UpdateProjectV2Input!) {
    updateProjectV2(input: $input) {
      projectV2 { ${PROJECT_FIELDS} }
    }
  }
`;

export const DELETE_PROJECT = /* GraphQL */ `
  mutation DeleteProject($id: ID!) {
    deleteProjectV2(input: { projectId: $id }) {
      projectV2 { id }
    }
  }
`;
