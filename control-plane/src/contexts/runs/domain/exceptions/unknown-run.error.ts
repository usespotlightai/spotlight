import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class UnknownRunError extends DomainError {
  readonly kind = 'not-found' as const;

  constructor(reason: string) {
    super(reason);
    this.name = 'UnknownRunError';
  }
}
