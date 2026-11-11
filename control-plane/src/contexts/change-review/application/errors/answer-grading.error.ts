import { ApplicationError } from '@shared-kernel/application/errors/application-error';

export class AnswerGradingError extends ApplicationError {
  readonly kind = 'upstream-error' as const;

  constructor() {
    super('Sorry, the answer could not be graded. Please try again later.');
    this.name = 'AnswerGradingError';
  }
}
