import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidEffortError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Effort ${reason}.`);
    this.name = 'InvalidEffortError';
  }
}
