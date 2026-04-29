// 03_startup_tokens — STARTUP. Composite returning { case_001, case_005, timestamp_iso }.
// All three share one timestamp because the function evaluates once at boot.
const ts = Date.now();
const tsIso = new Date(ts).toISOString();

export default function compute(_ctx, _path) {
  return {
    case_001: `startup-001-${ts}`,
    case_005: `startup-005-${ts}`,
    timestamp_iso: tsIso,
  };
}

export const scope = "STARTUP";
