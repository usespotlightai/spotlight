import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidHookFiringTransitionError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(reason: string) {
    super(`Hook firing ${reason}.`);
    this.name = 'InvalidHookFiringTransitionError';
  }
}
