import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidTokenHashError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor() {
    super('Token hash must be 64 hexadecimal characters.');
    this.name = 'InvalidTokenHashError';
  }
}
