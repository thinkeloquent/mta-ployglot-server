/**
 * Per-provider factories returning configured AsyncClient instances.
 *
 * Each `make<Provider>Client` reads its slice from the post-pipeline
 * `getConfig().providers[<name>]` and composes an AsyncClient via the
 * shared helpers in `_shared_fetch.mjs`. The yaml is the single source
 * of truth for base URLs, auth tokens (resolved at boot via
 * `{{fn:provider_api_keys.<name>}}`), credentials (`email` / `username`),
 * and static headers — no env reads here.
 *
 * Pattern B: factories stay separate, named functions for greppability;
 * shared logic lives in helpers; provider-specific quirks
 * (e.g. confluence's `/wiki` strip) stay visible inline.
 */
import { getConfig } from "@ployglot/app-yaml-fetch-config";
import { AsyncClient } from "@polyglot/fetch-http-client";
import {
  resolveAuth,
  resolveBaseUrl,
  resolveStaticHeaders,
  withProxyKwargs,
} from "./_shared_fetch.mjs";

function sliceFor(name) {
  const cfg = getConfig();
  const slice = cfg?.providers?.[name];
  if (!slice) {
    throw new Error(
      `cfg.providers.${name} is missing; check server.dev.yaml and slot 29 wiring`,
    );
  }
  return slice;
}

export function makeJiraClient() {
  const slice = sliceFor("jira");
  return new AsyncClient(withProxyKwargs({
    baseUrl: resolveBaseUrl(slice),
    auth:    resolveAuth(slice),
    headers: resolveStaticHeaders(slice),
  }));
}

export function makeConfluenceClient() {
  const slice = sliceFor("confluence");
  // Strip a trailing `/wiki` (and any trailing slash) from the resolved
  // base_url so route paths can carry the full `/wiki/rest/api/...`
  // prefix without double-prefixing when the yaml-resolved value is
  // `https://<tenant>.atlassian.net/wiki`. The yaml `base_url` stays
  // the configured value; only the AsyncClient kwarg is normalised.
  const baseUrl = resolveBaseUrl(slice)
    .replace(/\/wiki\/?$/, "")
    .replace(/\/$/, "");
  return new AsyncClient(withProxyKwargs({
    baseUrl,
    auth:    resolveAuth(slice),
    headers: resolveStaticHeaders(slice),
  }));
}

export function makeGithubClient() {
  const slice = sliceFor("github");
  return new AsyncClient(withProxyKwargs({
    baseUrl: resolveBaseUrl(slice),
    auth:    resolveAuth(slice),
    headers: resolveStaticHeaders(slice),
  }));
}

export function makeFigmaClient() {
  const slice = sliceFor("figma");
  return new AsyncClient(withProxyKwargs({
    baseUrl: resolveBaseUrl(slice),
    auth:    resolveAuth(slice),
    headers: resolveStaticHeaders(slice),
  }));
}

export function makeStatsigClient() {
  const slice = sliceFor("statsig");
  return new AsyncClient(withProxyKwargs({
    baseUrl: resolveBaseUrl(slice),
    auth:    resolveAuth(slice),
    headers: resolveStaticHeaders(slice),
  }));
}

export function makeSaucelabsClient() {
  const slice = sliceFor("saucelabs");
  return new AsyncClient(withProxyKwargs({
    baseUrl: resolveBaseUrl(slice),
    auth:    resolveAuth(slice),
    headers: resolveStaticHeaders(slice),
  }));
}

export const FACTORIES = {
  jira: makeJiraClient,
  confluence: makeConfluenceClient,
  github: makeGithubClient,
  figma: makeFigmaClient,
  statsig: makeStatsigClient,
  saucelabs: makeSaucelabsClient,
};

export const PROVIDERS = Object.freeze(Object.keys(FACTORIES));
