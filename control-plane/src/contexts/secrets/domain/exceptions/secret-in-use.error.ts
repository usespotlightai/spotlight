import type { SecretUses } from '@secrets/domain/value-objects/secret-uses.vo';

export class SecretInUseError extends Error {
  readonly kind = 'conflict' as const;

  constructor(secretName: string, uses: SecretUses) {
    super(`Secret ${secretName} is in use. Used by: ${uses.by.join(', ')}`);
    this.name = 'SecretInUseError';
  }
}
