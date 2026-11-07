import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidHandoverError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Handover ${reason}.`);
    this.name = 'InvalidHandoverError';
  }
}
