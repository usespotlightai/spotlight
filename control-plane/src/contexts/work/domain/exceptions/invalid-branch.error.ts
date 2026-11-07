import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidBranchError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Branch ${reason}.`);
    this.name = 'InvalidBranchError';
  }
}
