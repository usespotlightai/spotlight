import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidRunPageError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Run page ${reason}.`);
    this.name = 'InvalidRunPageError';
  }
}
