// @ts-nocheck
/**
 * Resolve a configuration value from the first of four sources:
 *   1. Direct argument (`arg`).
 *   2. Environment variable (`envKeys`).
 *   3. Config-object key (`config[configKey]`).
 *   4. Default value (`defaultValue`).
 *
 * See SPEC.md at the repo root for the canonical algorithm and drift resolutions.
 */
export function resolve(
  arg: any,
  envKeys: string[] | string | null | undefined,
  config: Record<string, any> | null | undefined,
  configKey: string | null | undefined,
  defaultValue: any,
): any {
  // Tier 1 — direct argument (D1: nullish is "unset")
  if (arg !== undefined && arg !== null) {
    return arg;
  }

  // Tier 2 — environment variables (D7: nullish envKeys short-circuits)
  if (envKeys != null) {
    if (Array.isArray(envKeys)) {
      for (const key of envKeys) {
        if (key) {
          const val = process.env[key];
          if (val !== undefined) return val;
        }
      }
    } else if (typeof envKeys === 'string' && envKeys) {
      const val = process.env[envKeys];
      if (val !== undefined) return val;
    }
  }

  // Tier 3 — config-object lookup (D3: value-non-nullish)
  if (config != null && configKey != null) {
    const val = config[configKey];
    if (val != null) return val;
  }

  // Tier 4 — default
  return defaultValue;
}

export const TRUTHY_STRINGS = ['true', '1', 'yes', 'on'] as const;

/**
 * Resolve a value via {@link resolve} and coerce to boolean per SPEC.md §"Boolean coercion".
 * Truthy strings are case-insensitive members of {@link TRUTHY_STRINGS}.
 */
export function resolveBool(
  arg: any,
  envKeys: string[] | string | null | undefined,
  config: Record<string, any> | null | undefined,
  configKey: string | null | undefined,
  defaultValue: boolean,
): boolean {
  const val = resolve(arg, envKeys, config, configKey, defaultValue);
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    return (TRUTHY_STRINGS as readonly string[]).includes(val.toLowerCase());
  }
  if (typeof val === 'number') return val !== 0;
  return Boolean(val);
}

const INT_STRING_RE = /^-?\d+$/;

/**
 * Resolve a value via {@link resolve} and coerce to integer per SPEC.md §"Integer coercion (D4, D5)".
 *
 * Strict parsing rules:
 *   - **D4**: decimal-shaped strings (e.g. "3.14") return `defaultValue`.
 *     `parseInt` would truncate to `3`; this function rejects.
 *   - **D5**: bool inputs (`true` / `false`) return `defaultValue`.
 *     `Number(true)` would give `1`; this function rejects.
 *   - **Floats with non-integer values** (e.g. `3.5`) return `defaultValue` —
 *     `Number.isInteger` is the gate.
 *
 * No exception escapes; every parse-failure path returns `defaultValue`.
 */
export function resolveInt(
  arg: any,
  envKeys: string[] | string | null | undefined,
  config: Record<string, any> | null | undefined,
  configKey: string | null | undefined,
  defaultValue: number,
): number {
  const val = resolve(arg, envKeys, config, configKey, defaultValue);
  if (typeof val === 'boolean') return defaultValue; // D5
  if (typeof val === 'number') {
    return Number.isInteger(val) ? val : defaultValue;
  }
  if (typeof val === 'string') {
    if (!INT_STRING_RE.test(val)) return defaultValue; // D4
    const parsed = Number.parseInt(val, 10);
    return Number.isFinite(parsed) ? parsed : defaultValue;
  }
  return defaultValue;
}

/**
 * Resolve a value via {@link resolve} and coerce to float per SPEC.md §"Float coercion (D6)".
 * Rejects partial-numeric strings (e.g. "12abc") — `parseFloat` would tokenize and return `12`;
 * this function uses `Number(val)` + `Number.isFinite` to require the entire string parse cleanly.
 */
export function resolveFloat(
  arg: any,
  envKeys: string[] | string | null | undefined,
  config: Record<string, any> | null | undefined,
  configKey: string | null | undefined,
  defaultValue: number,
): number {
  const val = resolve(arg, envKeys, config, configKey, defaultValue);
  if (typeof val === 'number') return Number.isFinite(val) ? val : defaultValue;
  if (typeof val === 'string') {
    if (val.trim() === '') return defaultValue; // Number("") → 0; reject
    const parsed = Number(val); // strict: "12abc" → NaN
    return Number.isFinite(parsed) ? parsed : defaultValue;
  }
  if (typeof val === 'boolean') return Number(val); // true→1, false→0 (no D5 analog)
  return defaultValue;
}
