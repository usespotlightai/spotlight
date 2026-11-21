import type { SecretUses } from '@secrets/domain/value-objects/secret-uses.vo';
import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class SecretInSandboxError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(secretName: string, uses: SecretUses) {
    super(
      `Secret ${secretName} is in the sandbox env of: ${uses.described.join(', ')}. Remove it from env there before sandbox = "stand-in"`,
    );
    this.name = 'SecretInSandboxError';
  }
}
