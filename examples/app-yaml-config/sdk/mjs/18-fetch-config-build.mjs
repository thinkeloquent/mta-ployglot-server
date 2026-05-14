#!/usr/bin/env node
// F05 / story 03 — getFetchConfig(serviceId, payload, customHeaders).
import { EndpointConfigSDK, loadConfigFromFile } from "@ployglot/app-yaml-fetch-config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = resolve(HERE, "../../../server/config/endpoint.dev.yaml");
loadConfigFromFile(FILE);
const sdk = new EndpointConfigSDK({ filePath: FILE });

const llm001 = sdk.getFetchConfig("llm001", { prompt: "Hello" }, { "X-Trace-Id": "trace-001" });
const fastify_ep = sdk.getFetchConfig("fastify", null);
const agents = sdk.getFetchConfig("agents001", { task: "ping" });

console.log(JSON.stringify({ llm001, fastify: fastify_ep, agents001: agents }, null, 2));
