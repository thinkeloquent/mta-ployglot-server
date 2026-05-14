const ENGINE_PKG = '@ployglot/runtime-template-resolver';

let _cached;

export async function defaultResolver() {
  if (_cached) return _cached;
  let mod;
  try {
    mod = await import(ENGINE_PKG);
  } catch (err) {
    throw new Error(
      `applier requires the '${ENGINE_PKG}' package to be installed when no resolver is injected. ` +
        `Install it or pass options.resolver explicitly. (cause: ${err?.message ?? err})`,
    );
  }
  if (typeof mod.createResolver !== 'function') {
    throw new Error(
      `'${ENGINE_PKG}' did not expose createResolver(); pass options.resolver explicitly.`,
    );
  }
  _cached = mod.createResolver();
  return _cached;
}
