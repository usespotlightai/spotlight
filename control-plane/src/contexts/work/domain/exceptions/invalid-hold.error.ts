import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidHoldError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`A hold ${reason}.`);
    this.name = 'InvalidHoldError';
  }
}
