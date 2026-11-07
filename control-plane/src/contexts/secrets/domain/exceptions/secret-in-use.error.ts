import type { SecretUses } from '@secrets/domain/value-objects/secret-uses.vo';
import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class SecretInUseError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(secretName: string, uses: SecretUses) {
    super(
      `Secret ${secretName} is in use. Used by: ${uses.described.join(', ')}`,
    );
    this.name = 'SecretInUseError';
  }
}
