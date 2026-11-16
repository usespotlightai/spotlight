import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidPushDiffError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`A push diff ${reason}.`);
    this.name = 'InvalidPushDiffError';
  }
}
