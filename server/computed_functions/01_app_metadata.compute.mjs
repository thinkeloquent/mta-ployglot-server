// 01_app_metadata — STARTUP. Returns { name, version, started_at }. Not referenced by
// server.dev.yaml directly but useful for SDK examples and future {{fn:app_metadata.X}} use.
const startedAt = new Date().toISOString();

export default function compute(_ctx, _path) {
  return {
    name: process.env.APP_NAME ?? "demo",
    version: process.env.APP_VERSION ?? "0.0.0",
    started_at: startedAt,
  };
}

export const scope = "STARTUP";
