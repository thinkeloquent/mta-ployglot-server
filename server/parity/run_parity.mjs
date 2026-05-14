import { startMock } from "../fastify/tests/integrations/_mock_origin.mjs";
import { bootInProcess as bootFastify } from "../fastify/tests/integrations/_boot.mjs";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

import { ENDPOINTS, fetchOne } from "./_drivers.mjs";
import { structuralDiff } from "./_diff.mjs";

async function bootFastapi(envOverrides) {
  const port = 52900 + Math.floor(Math.random() * 100);
  const env = { ...process.env, ...envOverrides, PORT: String(port) };
  const child = spawn("poetry", ["run", "python", "main.py"], {
    cwd: new URL("../fastapi/", import.meta.url).pathname,
    env,
    stdio: ["ignore", "inherit", "inherit"],
  });
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/healthz`);
      if (r.ok) {
        return {
          baseUrl: `http://127.0.0.1:${port}`,
          close: () => child.kill("SIGTERM"),
        };
      }
    } catch {}
    await sleep(200);
  }
  child.kill("SIGTERM");
  throw new Error("FastAPI failed to boot for parity run");
}

export async function diffAllProviders(fastifyUrl, fastapiUrl) {
  const diffs = [];
  for (const ep of ENDPOINTS) {
    const [fy, fa] = await Promise.all([
      fetchOne(fastifyUrl, ep),
      fetchOne(fastapiUrl, ep),
    ]);
    if (fy.status !== fa.status) {
      diffs.push(
        `${ep.name}: status ${fy.status} (fastify) vs ${fa.status} (fastapi)`,
      );
      continue;
    }
    const local = structuralDiff(fy.body, fa.body, `${ep.name}`);
    diffs.push(...local);
  }
  return diffs;
}

export async function runParity() {
  const mock = await startMock();
  const env = {
    JIRA_BASE_URL: mock.url,
    JIRA_EMAIL: "u",
    JIRA_API_TOKEN: "p",
    CONFLUENCE_BASE_URL: mock.url,
    CONFLUENCE_EMAIL: "u",
    CONFLUENCE_API_TOKEN: "p",
    GITHUB_API_BASE_URL: mock.url,
    GITHUB_TOKEN: "tok",
    FIGMA_API_BASE_URL: mock.url,
    FIGMA_TOKEN: "tok",
    STATSIG_BASE_URL: mock.url,
    STATSIG_API_KEY: "tok",
    SAUCELABS_BASE_URL: mock.url,
    SAUCE_USERNAME: "u",
    SAUCE_ACCESS_KEY: "p",
  };
  const fastify = await bootFastify(env);
  const fastapi = await bootFastapi(env);
  try {
    return await diffAllProviders(fastify.baseUrl, fastapi.baseUrl);
  } finally {
    await fastify.close();
    fastapi.close();
    await mock.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runParity().then((diffs) => {
    if (diffs.length === 0) {
      console.log("✓ parity OK across all providers");
      process.exit(0);
    }
    for (const d of diffs) console.error(d);
    process.exit(1);
  });
}
