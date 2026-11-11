import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class QuestionAlreadyAnsweredError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor() {
    super('You already answered this question.');
    this.name = 'QuestionAlreadyAnsweredError';
  }
}
