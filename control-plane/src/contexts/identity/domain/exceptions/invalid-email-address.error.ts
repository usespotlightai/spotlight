import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidEmailAddressError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(raw: string) {
    super(`Email address is not valid. Received: ${raw}`);
    this.name = 'InvalidEmailAddressError';
  }
}
