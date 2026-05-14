export class LoadError extends Error {
  constructor(message, { path, cause } = {}) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'LoadError';
    this.path = path;
  }
}
