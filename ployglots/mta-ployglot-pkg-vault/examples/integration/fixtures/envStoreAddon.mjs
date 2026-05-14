// Example addon for @ployglot/fastify-server consumers.
// Signature matches fastify_server/.agents/addon-author.md from
// mta-ployglot-server-bootstrap.

import { EnvStore } from '@polyglot/vault-file';

/**
 * @param {object} ctx - fastify addon context with `report` and `app`.
 * @returns {Promise<object>} LoaderReport
 */
export async function envStoreAddon(ctx) {
  try {
    const result = EnvStore.onStartup(process.env.VAULT_ENV_PATH ?? '.env');
    ctx.report.info(`vault-file: loaded ${result.totalVarsLoaded} vars`);
    return ctx.report.ok({ addon: 'envStore', totalVarsLoaded: result.totalVarsLoaded });
  } catch (err) {
    ctx.report.error(err);
    return ctx.report.fail({ addon: 'envStore', message: err.message });
  }
}
