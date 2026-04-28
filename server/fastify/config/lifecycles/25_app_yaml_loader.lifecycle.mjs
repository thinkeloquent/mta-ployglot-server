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
        configDir: configDir ?? boundConfigDir,
        missing: opts.missing,
      }),
    load_files: (paths) => loadFiles(paths),
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
  const dir =
    config?.app_yaml?.config_dir ??
    new URL("../app-yaml/", import.meta.url).pathname;
  await server.register(wrapped, { configDir: dir });
  server.log.info({ dir }, "app-yaml-loader decorator registered");
}
