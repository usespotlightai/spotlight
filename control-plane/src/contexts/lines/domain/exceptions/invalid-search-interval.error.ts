import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidSearchIntervalError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(readonly because: string) {
    super(`Search interval ${because}.`);
    this.name = 'InvalidSearchIntervalError';
  }
}
