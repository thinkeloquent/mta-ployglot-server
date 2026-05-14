const SAFE_BASENAME = /^[A-Za-z0-9_][A-Za-z0-9_.-]*\.(ya?ml)$/;

export function assertSafeBasename(name) {
  if (typeof name !== "string" || name.length === 0) {
    throw new Error("filename must be a non-empty string");
  }
  if (!SAFE_BASENAME.test(name)) {
    throw new Error(
      `filename must match ${SAFE_BASENAME} (basename only, .yaml/.yml extension required)`
    );
  }
  return name;
}
