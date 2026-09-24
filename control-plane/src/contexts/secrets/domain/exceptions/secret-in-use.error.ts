import type { SecretUses } from '@secrets/domain/value-objects/secret-uses.vo';

export class SecretInUseError extends Error {
  readonly violation = 'conflict' as const;

  constructor(secretName: string, uses: SecretUses) {
    super(
      `The ${secretName} secret is still worn by ${uses.by.join(', ')}; stop those naming it first`,
    );
    this.name = 'SecretInUseError';
  }
}
