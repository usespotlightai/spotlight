import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidWorkingCopyStoreError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(
    readonly field: string,
    readonly because: string,
  ) {
    super(`Working copy store ${field} ${because}.`);
    this.name = 'InvalidWorkingCopyStoreError';
  }
}
