import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidOutcomeError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Run outcome ${reason}.`);
    this.name = 'InvalidOutcomeError';
  }
}
