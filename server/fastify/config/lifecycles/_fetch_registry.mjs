import { FACTORIES, PROVIDERS } from "./_fetch_factories.mjs";

export function createRegistry(log) {
  const constructed = new Map();

  const handler = {
    get(_t, prop) {
      if (prop === "_constructed") return constructed;
      if (prop === Symbol.iterator) return undefined;
      if (typeof prop !== "string") return undefined;
      if (!Object.prototype.hasOwnProperty.call(FACTORIES, prop)) return undefined;

      const cached = constructed.get(prop);
      if (cached) return cached;

      const promise = (async () => {
        try {
          return FACTORIES[prop]();
        } catch (err) {
          log?.error?.({ provider: prop, err }, "fetch-client construction failed");
          throw err;
        }
      })();
      constructed.set(prop, promise);
      return promise;
    },
    has(_t, prop) {
      return Object.prototype.hasOwnProperty.call(FACTORIES, prop);
    },
    ownKeys() {
      return [...PROVIDERS];
    },
    getOwnPropertyDescriptor(_t, prop) {
      if (Object.prototype.hasOwnProperty.call(FACTORIES, prop)) {
        return { enumerable: true, configurable: true };
      }
      return undefined;
    },
  };

  return new Proxy({}, handler);
}
