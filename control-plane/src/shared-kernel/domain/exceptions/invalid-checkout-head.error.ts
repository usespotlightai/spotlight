import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidCheckoutHeadError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`A checkout head ${reason}.`);
    this.name = 'InvalidCheckoutHeadError';
  }
}
