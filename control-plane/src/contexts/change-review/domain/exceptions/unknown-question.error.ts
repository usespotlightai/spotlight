import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class UnknownQuestionError extends DomainError {
  readonly kind = 'not-found' as const;

  constructor() {
    super('The change stack does not ask this question.');
    this.name = 'UnknownQuestionError';
  }
}
