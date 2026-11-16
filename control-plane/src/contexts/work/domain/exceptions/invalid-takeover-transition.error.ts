import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidTakeoverTransitionError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(reason: string) {
    super(`A takeover ${reason}.`);
    this.name = 'InvalidTakeoverTransitionError';
  }
}
