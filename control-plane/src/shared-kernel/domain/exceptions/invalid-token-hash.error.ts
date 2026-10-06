export class InvalidTokenHashError extends Error {
  readonly violation = 'invalid' as const;

  constructor() {
    super('Token hash must be 64 hexadecimal characters.');
    this.name = 'InvalidTokenHashError';
  }
}
