import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidHoldTransitionError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(reason: string) {
    super(`A hold ${reason}.`);
    this.name = 'InvalidHoldTransitionError';
  }
}
