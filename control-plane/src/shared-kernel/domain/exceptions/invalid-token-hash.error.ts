export class InvalidTokenHashError extends Error {
  readonly violation = 'invalid' as const;

  constructor() {
    super('A token hash must be 64 hexadecimal characters');
    this.name = 'InvalidTokenHashError';
  }
}
