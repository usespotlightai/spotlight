import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class SecretVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(name: string) {
    super(
      `Secret ${name} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'SecretVersionConflictError';
  }
}
