export class InvalidTokenHashError extends Error {
  readonly kind = 'invalid' as const;

  constructor() {
    super('Token hash must be 64 hexadecimal characters.');
    this.name = 'InvalidTokenHashError';
  }
}
