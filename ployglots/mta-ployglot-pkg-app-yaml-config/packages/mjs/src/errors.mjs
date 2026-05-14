export class ImmutabilityError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ImmutabilityError';
  }
}
