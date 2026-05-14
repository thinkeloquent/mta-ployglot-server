const RESOLVE_NODE = /* GraphQL */ `
  query ResolveIssueNode($id: ID!) {
    node(id: $id) {
      ... on Issue { id databaseId number repository { name owner { login } } }
      ... on PullRequest { id databaseId number repository { name owner { login } } }
    }
  }
`;

const RESOLVE_BY_PATH = /* GraphQL */ `
  query ResolveIssueByPath($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      issueOrPullRequest(number: $number) {
        ... on Issue { id databaseId number }
        ... on PullRequest { id databaseId number }
      }
    }
  }
`;

export function makeIssueRefResolver(client) {
  return async function resolve(ref) {
    if (typeof ref === 'string') {
      const data = await client.graphql(RESOLVE_NODE, { id: ref });
      const n = data?.node;
      if (!n) throw new Error(`could not resolve node ${ref}`);
      return {
        nodeId: n.id,
        databaseId: n.databaseId,
        owner: n.repository.owner.login,
        repo: n.repository.name,
        number: n.number,
      };
    }
    if (ref?.owner && ref?.repo && ref?.number) {
      const data = await client.graphql(RESOLVE_BY_PATH, ref);
      const n = data?.repository?.issueOrPullRequest;
      if (!n) throw new Error(`could not resolve ${ref.owner}/${ref.repo}#${ref.number}`);
      return { nodeId: n.id, databaseId: n.databaseId, owner: ref.owner, repo: ref.repo, number: n.number };
    }
    throw new Error('issueRef must be a node id string or { owner, repo, number }');
  };
}
