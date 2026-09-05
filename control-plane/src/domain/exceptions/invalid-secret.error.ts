export class InvalidSecretError extends Error {
  readonly violation = 'invalid' as const;

  constructor() {
    super('A secret must be something: an empty value is not a secret');
    this.name = 'InvalidSecretError';
  }
}
