export class ConfigError extends Error {
  constructor(message, serviceId = null, available = []) {
    super(message);
    this.name = 'ConfigError';
    this.serviceId = serviceId;
    this.available = available;
  }
}
