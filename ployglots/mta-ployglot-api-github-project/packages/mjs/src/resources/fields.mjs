import { LIST_FIELDS, GET_FIELD, CREATE_FIELD, UPDATE_FIELD, DELETE_FIELD } from '../graphql/fields.mjs';
import { paginate } from '../client/paginate.mjs';
import { validateCreateInput } from './fields-validation.mjs';
import { buildOptionUpsertList } from './fields-options-diff.mjs';
import { BuiltInFieldError } from '../client/errors.mjs';

const BUILT_IN_FIELDS = new Set([
  'Title', 'Status', 'Assignees', 'Labels', 'Milestone',
  'Repository', 'Linked pull requests', 'Reviewers',
]);

const annotate = (f) => ({ ...f, isBuiltIn: BUILT_IN_FIELDS.has(f.name) });

export function makeFields(client) {
  async function* list(projectId) {
    for await (const node of paginate(client, {
      query: LIST_FIELDS, variables: { projectId }, path: 'node.fields',
    })) yield annotate(node);
  }

  async function get(fieldId) {
    const data = await client.graphql(GET_FIELD, { id: fieldId });
    return annotate(data.node);
  }

  async function create(projectId, def) {
    validateCreateInput(def);
    const input = {
      projectId,
      name: def.name,
      dataType: def.dataType,
      ...(def.singleSelectOptions ? {
        singleSelectOptions: def.singleSelectOptions.map(o => ({
          name: o.name,
          color: o.color ?? 'GRAY',
          description: o.description ?? '',
        })),
      } : {}),
      ...(def.iterationConfiguration ? { iterationConfiguration: def.iterationConfiguration } : {}),
    };
    const data = await client.graphql(CREATE_FIELD, { input });
    return annotate(data.createProjectV2Field.projectV2Field);
  }

  async function assertNotBuiltIn(fieldId) {
    const f = await get(fieldId);
    if (f.isBuiltIn) {
      throw new BuiltInFieldError(`field "${f.name}" is built-in and cannot be modified or deleted`);
    }
  }

  async function update(fieldId, fields) {
    await assertNotBuiltIn(fieldId);
    const input = { fieldId };
    if (fields.name !== undefined) input.name = fields.name;
    if (fields.singleSelectOptions !== undefined) {
      input.singleSelectOptions = buildOptionUpsertList(fields.singleSelectOptions);
    }
    const data = await client.graphql(UPDATE_FIELD, { input });
    return annotate(data.updateProjectV2Field.projectV2Field);
  }

  async function deleteField(fieldId) {
    await assertNotBuiltIn(fieldId);
    const data = await client.graphql(DELETE_FIELD, { id: fieldId });
    return data.deleteProjectV2Field.projectV2Field;
  }

  return { list, get, create, update, delete: deleteField, BUILT_IN_FIELDS };
}
