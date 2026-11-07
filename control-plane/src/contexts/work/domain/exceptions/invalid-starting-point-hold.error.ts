import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidStartingPointHoldError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Starting point hold ${reason}.`);
    this.name = 'InvalidStartingPointHoldError';
  }
}
