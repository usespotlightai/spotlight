export class InvalidVaultKeyError extends Error {
  readonly violation = 'invalid' as const;

  constructor() {
    super('A vault key is never empty');
    this.name = 'InvalidVaultKeyError';
  }
}
