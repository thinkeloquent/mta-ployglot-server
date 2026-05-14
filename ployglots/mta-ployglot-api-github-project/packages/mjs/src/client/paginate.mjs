function deepGet(obj, path) {
  return path.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}

/**
 * Walks a GraphQL connection by following pageInfo.endCursor.
 * @param {object} client — { graphql }
 * @param {object} opts — { query, variables, path }
 * @returns {AsyncIterable<unknown>}
 */
export async function* paginate(client, { query, variables, path }) {
  let after = variables?.after ?? null;
  while (true) {
    const data = await client.graphql(query, { ...variables, after });
    const conn = deepGet(data, path);
    if (!conn) return;
    for (const node of conn.nodes ?? []) yield node;
    if (!conn.pageInfo?.hasNextPage) return;
    after = conn.pageInfo.endCursor;
  }
}
