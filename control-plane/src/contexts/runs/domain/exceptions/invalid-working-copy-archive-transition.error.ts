import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidWorkingCopyArchiveTransitionError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(reason: string) {
    super(`Working copy archive ${reason}.`);
    this.name = 'InvalidWorkingCopyArchiveTransitionError';
  }
}
