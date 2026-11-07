import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidStartingPointError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Starting point ${reason}.`);
    this.name = 'InvalidStartingPointError';
  }
}
