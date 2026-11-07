import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class UnknownDecisionError extends DomainError {
  readonly kind = 'not-found' as const;

  constructor() {
    super('Decision not found.');
    this.name = 'UnknownDecisionError';
  }
}
