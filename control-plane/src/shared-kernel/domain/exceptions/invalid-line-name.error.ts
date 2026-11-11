import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidLineNameError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Line name ${reason}.`);
    this.name = 'InvalidLineNameError';
  }
}
