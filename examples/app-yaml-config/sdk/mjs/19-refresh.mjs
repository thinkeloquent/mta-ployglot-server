#!/usr/bin/env node
// F05 / story 04 — refreshConfig() against a temp endpoint.dev.yaml.
// Use parse-modify-write so the new endpoint lands inside the `endpoints:` map
// (in-place append wouldn't merge correctly because the file ends with intent_mapping:).
import { EndpointConfigSDK, loadConfigFromFile } from "@ployglot/app-yaml-fetch-config";
import { mkdtempSync, copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import yaml from "js-yaml";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, "../../../server/config/endpoint.dev.yaml");

const tmp = mkdtempSync(join(tmpdir(), "epcfg-"));
const tmpFile = join(tmp, "endpoint.dev.yaml");
copyFileSync(SRC, tmpFile);

loadConfigFromFile(tmpFile);
const sdk = new EndpointConfigSDK({ filePath: tmpFile });

const before = sdk.listKeys().sort();

const doc = yaml.load(readFileSync(tmpFile, "utf8"));
doc.endpoints.llm003 = {
  name: "Tertiary LLM",
  tags: ["llm", "tertiary"],
  baseUrl: "http://localhost:53000",
  method: "POST",
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
  bodyType: "json",
};
writeFileSync(tmpFile, yaml.dump(doc));

sdk.refreshConfig();
const after = sdk.listKeys().sort();
const newKeys = after.filter((k) => !before.includes(k));

console.log(JSON.stringify({
  before_count: before.length,
  after_count: after.length,
  new_keys: newKeys,
  invariant_llm003_appeared: newKeys.includes("llm003"),
}, null, 2));
