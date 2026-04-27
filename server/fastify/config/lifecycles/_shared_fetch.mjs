/**
 * Shared env + proxy helpers for Fastify integration routes.
 *
 * Inlined from mta-ployglot-pkg-fetch-client/packages/ts/examples/_shared.ts
 * because the package's examples directory is not part of its published
 * surface (`files: ["dist", "README.md"]`).
 *
 * Leading underscore prevents the lifecycle addon's discoverer from
 * picking it up as a `*.lifecycle.mjs` file.
 */
import { Proxy } from "@polyglot/fetch-http-client";

export function requireEnv(name) {
  const v = process.env[name];
  if (v === undefined || v.length === 0) {
    throw new Error(
      `Missing env ${name}. Set it in your shell, a .env file, or your secret manager and rerun.`,
    );
  }
  return v;
}

export function optionalEnv(name, fallback) {
  const v = process.env[name];
  return v !== undefined && v.length > 0 ? v : fallback;
}

/**
 * @param {{ host?: string, user?: string, pass?: string }} options
 * @returns {Proxy | undefined}
 */
export function buildProxy(options = {}) {
  const host = options.host ?? process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY;
  if (host === undefined || host.length === 0) return undefined;

  const user = options.user ?? process.env.HTTP_PROXY_USER;
  const pass = options.pass ?? process.env.HTTP_PROXY_PASS;

  if (user !== undefined && user.length > 0 && pass !== undefined && pass.length > 0) {
    return new Proxy({ url: host, auth: { username: user, password: pass } });
  }
  return new Proxy({ url: host });
}

export function basicAuthHeader(user, pass) {
  return "Basic " + Buffer.from(`${user}:${pass}`, "utf-8").toString("base64");
}
