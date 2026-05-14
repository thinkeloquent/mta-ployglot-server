export function createLogger(name = 'app-yaml-config', _file) {
  const tag = name ? `[${name}]` : '';
  return {
    debug: (...args) => console.debug(tag, ...args),
    info: (...args) => console.info(tag, ...args),
    warn: (...args) => console.warn(tag, ...args),
    error: (...args) => console.error(tag, ...args),
  };
}
