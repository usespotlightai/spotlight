import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidWorkingCopyArchiveError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Working copy archive ${reason}.`);
    this.name = 'InvalidWorkingCopyArchiveError';
  }
}
