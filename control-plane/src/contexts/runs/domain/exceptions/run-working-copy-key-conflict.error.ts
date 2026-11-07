import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class RunWorkingCopyKeyConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(key: string) {
    super(
      `Working copy ${key} belongs to work Spotlight orders. A run you order can only carry on its own working copies.`,
    );
    this.name = 'RunWorkingCopyKeyConflictError';
  }
}
