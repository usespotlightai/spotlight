import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidRunFilterError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Run filter ${reason}.`);
    this.name = 'InvalidRunFilterError';
  }
}
