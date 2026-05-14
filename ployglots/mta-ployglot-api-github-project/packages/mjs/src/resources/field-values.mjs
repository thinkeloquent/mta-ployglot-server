import { SET_VALUE, CLEAR_VALUE } from '../graphql/values.mjs';
import { buildValueInput } from './values-dispatch.mjs';
import { FieldNotWritableError, FieldOptionNotFoundError } from '../client/errors.mjs';

const READ_ONLY_BUILT_INS = new Set(['Title', 'Linked pull requests', 'Reviewers', 'Repository']);

export function makeValues(client, { items, fields }) {
  const fieldCache = new Map();

  async function getFieldCached(fieldId) {
    if (!fieldCache.has(fieldId)) {
      const f = await fields.get(fieldId);
      fieldCache.set(fieldId, f);
    }
    return fieldCache.get(fieldId);
  }

  function resolveOptionId(field, optionNameOrId) {
    if (/^[A-Z]{2,}_/.test(optionNameOrId)) return optionNameOrId;
    const opt = (field.options ?? []).find(o => o.name === optionNameOrId);
    if (!opt) {
      throw new FieldOptionNotFoundError(
        `option "${optionNameOrId}" not found in field "${field.name}"`,
        { field: field.name, requested: optionNameOrId, available: (field.options ?? []).map(o => o.name) },
      );
    }
    return opt.id;
  }

  async function get(itemId, fieldId) {
    const item = await items.get(itemId);
    return item.fieldValues.find(v => v.fieldId === fieldId) ?? null;
  }

  async function list(itemId) {
    const item = await items.get(itemId);
    return item.fieldValues;
  }

  async function findItemsWithValue(projectId, fieldName, predicate) {
    const matches = [];
    for await (const item of items.list(projectId)) {
      const fv = item.fieldValues.find(v => v.fieldName === fieldName);
      if (fv && predicate(fv.value)) matches.push(item);
    }
    return matches;
  }

  async function set(projectId, itemId, fieldId, value) {
    const field = await getFieldCached(fieldId);
    if (READ_ONLY_BUILT_INS.has(field.name)) {
      throw new FieldNotWritableError(`field "${field.name}" is not writable via the Projects v2 value API`);
    }
    let resolved = value;
    if (field.dataType === 'SINGLE_SELECT' && typeof value === 'string') {
      resolved = resolveOptionId(field, value);
    }
    const input = {
      projectId,
      itemId,
      fieldId,
      value: buildValueInput(field.dataType, resolved, field),
    };
    const data = await client.graphql(SET_VALUE, { input });
    return data.updateProjectV2ItemFieldValue.projectV2Item;
  }

  /**
   * Clear a field value (reset to null).
   *
   * Note on auto-populate: GitHub project workflows can auto-set field values
   * on events (e.g. PR opened → Status: In Progress). Workflow management is
   * a separate concern; this library does not configure workflows.
   * See: https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-built-in-automations
   */
  async function clear(projectId, itemId, fieldId) {
    const data = await client.graphql(CLEAR_VALUE, { projectId, itemId, fieldId });
    return data.clearProjectV2ItemFieldValue.projectV2Item;
  }

  const fieldNameCache = new Map();
  async function resolveFieldIdByName(projectId, name) {
    const key = `${projectId}:${name}`;
    if (fieldNameCache.has(key)) return fieldNameCache.get(key);
    let id;
    for await (const f of fields.list(projectId)) {
      if (f.name === name) { id = f.id; break; }
    }
    if (!id) throw new Error(`field "${name}" not found in project ${projectId}`);
    fieldNameCache.set(key, id);
    return id;
  }

  return { get, list, findItemsWithValue, set, clear, resolveFieldIdByName };
}
