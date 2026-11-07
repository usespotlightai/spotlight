import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidRunSpecError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Run spec ${reason}.`);
    this.name = 'InvalidRunSpecError';
  }
}
