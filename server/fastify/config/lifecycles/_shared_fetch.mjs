/**
 * Shared env + proxy helpers + cfg-slice composition primitives.
 *
 * The env/proxy halves are inlined from
 * mta-ployglot-pkg-fetch-client/packages/ts/examples/_shared.ts.
 *
 * The `resolve*` / `withProxyKwargs` helpers below are the reusable
 * building blocks each per-provider factory in `_fetch_factories.mjs`
 * calls to assemble an AsyncClient from the post-pipeline
 * `cfg.providers.<name>` slice. They are intentionally named,
 * single-purpose helpers (Pattern B): each factory stays a separate,
 * greppable function and composes these primitives — provider-specific
 * quirks (e.g. confluence's `/wiki` strip) remain inline in the factory
 * that owns them.
 *
 * Leading underscore prevents the lifecycle addon's discoverer from
 * picking it up as a `*.lifecycle.mjs` file.
 */
import {
  APIKeyAuth,
  BasicAuth,
  BearerAuth,
  Proxy,
} from "@polyglot/fetch-http-client";

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

// ---------------------------------------------------------------------------
// cfg-slice composition helpers (Pattern B)
// ---------------------------------------------------------------------------

/**
 * Return the post-pipeline `base_url` from a provider cfg slice.
 * Throws if the slice has no resolved URL.
 */
export function resolveBaseUrl(slice) {
  const base = slice?.base_url;
  if (!base) {
    throw new Error(
      "missing base_url in cfg slice; check yaml + overwrite_from_context",
    );
  }
  return base;
}

/**
 * Pick the @polyglot/fetch-http-client Auth instance from a cfg slice.
 * Maps yaml `endpoint_auth_type` to the corresponding Auth class.
 */
export function resolveAuth(slice) {
  const authType = slice?.endpoint_auth_type;
  const token = slice?.endpoint_api_key;
  if (authType === "bearer") return new BearerAuth(token);
  if (authType === "basic_email_token") return new BasicAuth(slice.email, token);
  if (authType === "basic") return new BasicAuth(slice.username, token);
  if (authType === "custom" || authType === "custom_header") {
    return new APIKeyAuth(token, slice.api_auth_header_name);
  }
  throw new Error(`unsupported endpoint_auth_type: ${JSON.stringify(authType)}`);
}

/**
 * Return the static (non-templated) headers from a cfg slice.
 * Strips keys whose value is null — those are placeholders for
 * per-request templates handled by buildEcho, not the AsyncClient.
 */
export function resolveStaticHeaders(slice) {
  const headers = slice?.headers ?? {};
  const out = {};
  for (const [k, v] of Object.entries(headers)) {
    if (v !== null && v !== undefined) out[k] = v;
  }
  return out;
}

/**
 * Attach a Proxy to an AsyncClient kwargs object if the env says so.
 * Mirrors `withProxy` from the pre-refactor factories: reads
 * HTTPS_PROXY / HTTP_PROXY via buildProxy({}). Per-provider yaml
 * `proxy_url` is not consumed here yet.
 */
export function withProxyKwargs(opts) {
  const proxy = buildProxy({});
  return proxy ? { ...opts, proxy } : opts;
}
