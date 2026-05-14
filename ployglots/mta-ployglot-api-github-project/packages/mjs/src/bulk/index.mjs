import { pLimit } from './p-limit.mjs';
import { tokenBucket } from './token-bucket.mjs';
import { findCycles } from './cycles.mjs';

export function makeBulk(client, { values, items, relations } = {}) {
  const defaultBucket = tokenBucket({ tokens: 80, intervalMs: 60000 });

  /**
   * @returns {Promise<{ok: any[], failed: {input: any, error: Error}[]}>}
   */
  async function run(inputs, doOne, { concurrency = 5, bucket = defaultBucket } = {}) {
    const limit = pLimit(concurrency);
    const result = { ok: [], failed: [] };
    await Promise.all(inputs.map(input =>
      limit(async () => {
        await bucket.take();
        try { result.ok.push(await doOne(input)); }
        catch (error) { result.failed.push({ input, error }); }
      }),
    ));
    return result;
  }

  async function updateItems(projectId, updates, opts = {}) {
    return run(updates, async ({ itemId, fieldUpdates }) => {
      const out = [];
      for (const [name, value] of Object.entries(fieldUpdates)) {
        const fieldId = name.startsWith('PVTF_')
          ? name
          : await values.resolveFieldIdByName(projectId, name);
        out.push(await values.set(projectId, itemId, fieldId, value));
      }
      return out;
    }, opts);
  }

  async function assignField(projectId, { fieldId, value }, itemIds, opts = {}) {
    return run(itemIds, (itemId) => values.set(projectId, itemId, fieldId, value), opts);
  }

  async function moveStatus(projectId, { statusFieldId, optionId }, itemIds, opts = {}) {
    return assignField(projectId, { fieldId: statusFieldId, value: optionId }, itemIds, opts);
  }

  async function bulkAdd(projectId, contentIds, opts = {}) {
    return run(contentIds, (contentId) => items.add(projectId, contentId), opts);
  }

  async function validateDependencyGraph(projectId) {
    const graph = await relations.dependencies.graph(projectId);
    return { cycles: findCycles(graph) };
  }

  return { updateItems, assignField, moveStatus, bulkAdd, validateDependencyGraph };
}
