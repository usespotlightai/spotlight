import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidRunConnectionError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(field: string, reason: string) {
    super(`The connection record ${field} ${reason}.`);
    this.name = 'InvalidRunConnectionError';
  }
}
