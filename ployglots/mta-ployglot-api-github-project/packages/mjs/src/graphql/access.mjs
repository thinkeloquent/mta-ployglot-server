export const COLLAB_FRAGMENT = /* GraphQL */ `
  fragment CollabFields on ProjectV2Actor {
    role
    actor {
      __typename
      ... on User { id login }
      ... on Team { id slug combinedSlug }
    }
  }
`;

export const LIST_COLLABORATORS = /* GraphQL */ `
  query ListCollaborators($projectId: ID!, $after: String) {
    node(id: $projectId) {
      ... on ProjectV2 {
        collaborators(first: 50, after: $after) {
          nodes { ...CollabFields }
          pageInfo { hasNextPage endCursor }
        }
      }
    }
  }
  ${COLLAB_FRAGMENT}
`;

export const GET_BASE_ROLE = /* GraphQL */ `
  query GetBaseRole($projectId: ID!) {
    node(id: $projectId) { ... on ProjectV2 { id } }
  }
`;

export const UPDATE_COLLABORATORS = /* GraphQL */ `
  mutation UpdateCollaborators($input: UpdateProjectV2CollaboratorsInput!) {
    updateProjectV2Collaborators(input: $input) {
      collaborators(first: 50) { nodes { ...CollabFields } }
    }
  }
  ${COLLAB_FRAGMENT}
`;

export const UPDATE_BASE_ROLE = /* GraphQL */ `
  mutation UpdateBaseRole($projectId: ID!, $role: ProjectV2Roles!) {
    updateProjectV2(input: { projectId: $projectId, baseRole: $role }) {
      projectV2 { id }
    }
  }
`;

export const RESOLVE_USER = /* GraphQL */ `
  query ResolveUser($login: String!) { user(login: $login) { id } }
`;

export const RESOLVE_TEAM = /* GraphQL */ `
  query ResolveTeam($org: String!, $slug: String!) {
    organization(login: $org) { team(slug: $slug) { id } }
  }
`;
