import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidModelUsageError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Model usage ${reason}.`);
    this.name = 'InvalidModelUsageError';
  }
}
