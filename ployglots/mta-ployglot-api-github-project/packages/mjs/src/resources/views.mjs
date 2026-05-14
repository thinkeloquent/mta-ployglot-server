import { LIST_VIEWS, GET_VIEW, UPDATE_VIEW } from '../graphql/views.mjs';
import { paginate } from '../client/paginate.mjs';
import { toLayoutName } from './views-layout.mjs';
import { ViewOperationUnsupportedError } from '../client/errors.mjs';

const SUPPORTED_KEYS = new Set(['name', 'filter']);
const UNSUPPORTED_DOC = 'https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects';

function shapeView(node) {
  return {
    id: node.id,
    name: node.name,
    number: node.number,
    layout: toLayoutName(node.layout),
    filter: node.filter ?? '',
    groupBy: (node.groupByFields?.nodes ?? []).map(f => ({ id: f.id, name: f.name })),
    sortBy:  (node.sortByFields?.nodes  ?? []).map(s => ({ fieldId: s.field.id, fieldName: s.field.name, direction: s.direction })),
    visibleFields: (node.fields?.nodes ?? []).map(f => ({ id: f.id, name: f.name })),
  };
}

function unsupported(op) {
  return () => {
    throw new ViewOperationUnsupportedError(
      `view ${op} is not exposed by the Projects v2 GraphQL API`,
      { docLink: UNSUPPORTED_DOC, op },
    );
  };
}

export function makeViews(client) {
  async function* list(projectId) {
    for await (const node of paginate(client, {
      query: LIST_VIEWS, variables: { projectId }, path: 'node.views',
    })) yield shapeView(node);
  }

  async function get(viewId) {
    const data = await client.graphql(GET_VIEW, { id: viewId });
    return shapeView(data.node);
  }

  async function update(viewId, fields) {
    const unsupportedKeys = Object.keys(fields).filter(k => !SUPPORTED_KEYS.has(k));
    if (unsupportedKeys.length) {
      throw new ViewOperationUnsupportedError(
        `view update for ${unsupportedKeys.join(', ')} is not exposed by the Projects v2 GraphQL API`,
        { docLink: UNSUPPORTED_DOC, unsupported: unsupportedKeys },
      );
    }
    const input = { viewId, ...fields };
    const data = await client.graphql(UPDATE_VIEW, { input });
    return shapeView(data.updateProjectV2View.projectV2View);
  }

  return {
    list, get, update,
    create: unsupported('create'),
    delete: unsupported('delete'),
    changeLayout: unsupported('changeLayout'),
  };
}

export { shapeView };
