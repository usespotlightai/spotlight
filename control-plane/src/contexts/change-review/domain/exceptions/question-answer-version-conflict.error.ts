import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class QuestionAnswerVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(id: string) {
    super(
      `Question answer ${id} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'QuestionAnswerVersionConflictError';
  }
}
