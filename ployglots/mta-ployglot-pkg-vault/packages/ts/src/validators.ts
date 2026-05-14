// @ts-nocheck
export class EnvKeyNotFoundError extends Error {
  readonly key: string;

  constructor(key: string) {
    super(`Environment variable '${key}' not found`);
    this.name = 'EnvKeyNotFoundError';
    this.key = key;
    Object.setPrototypeOf(this, EnvKeyNotFoundError.prototype);
  }
}
