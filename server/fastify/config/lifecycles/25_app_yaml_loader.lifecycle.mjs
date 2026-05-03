import fp from "fastify-plugin";
import {
  loadFiles,
  loadFromConfigDir,
  resolveConfigDir,
  clearCache,
  LoadError,
} from "@ployglot/app-yaml-loader";

function makeHandle(boundConfigDir) {
  return {
    load_from_config_dir: (configDir, opts = {}) =>
      loadFromConfigDir({
        ...opts,
        configDir: configDir ?? boundConfigDir,
      }),
    load_files: (paths, opts = {}) => loadFiles(paths, opts),
    resolve_config_dir: () => resolveConfigDir(boundConfigDir),
    clear_cache: () => clearCache(),
    config_dir: boundConfigDir,
    LoadError,
  };
}

async function appYamlLoaderPlugin(fastify, opts) {
  const configDir = opts?.configDir ?? null;
  const handle = makeHandle(configDir);

  fastify.decorate("app_yaml_loader", handle);
  fastify.decorateRequest("app_yaml_loader", null);
  fastify.addHook("onRequest", async (req) => {
    req.app_yaml_loader = handle;
  });
}

const wrapped = fp(appYamlLoaderPlugin, {
  name: "app-yaml-loader",
  fastify: ">=4",
});

export default async function lifecycle(server, config) {
  // Resolution order: explicit config arg → APP_YAML_FIXTURES_DIR env (set by
  // Makefile.devmode for staged dev-mode boots) → walk up from this file to
  // server/config/. The env override is what makes dev mode work — the staged
  // file lives under .dev/fastify-app/config/lifecycles/, so the relative walk
  // alone would land at .dev/config/ (which the rsync does not stage).
  const dir =
    config?.app_yaml?.config_dir ??
    process.env.APP_YAML_FIXTURES_DIR ??
    new URL("../../../config/", import.meta.url).pathname;
  await server.register(wrapped, { configDir: dir });
  server.log.info({ dir }, "app-yaml-loader decorator registered");
}
