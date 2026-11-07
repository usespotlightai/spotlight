import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidRunOrderError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Run order ${reason}.`);
    this.name = 'InvalidRunOrderError';
  }
}
