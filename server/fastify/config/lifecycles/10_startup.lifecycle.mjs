export function onInit(server, config) {
  server.log.info({ title: config.title, port: config.port }, "init hook: polyglot boot complete");
}

export async function onStartup(server) {
  server.log.info("startup hook: server is ready for traffic");
}

export async function onShutdown(server) {
  server.log.info("shutdown hook: draining connections");
}
