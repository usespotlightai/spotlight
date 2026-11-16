import { ApplicationError } from '@shared-kernel/application/errors/application-error';

export class AnswerCreditsError extends ApplicationError {
  readonly kind = 'payment-required' as const;

  constructor() {
    super(
      'The inference endpoint has no credits left. Please add credits at your provider.',
    );
    this.name = 'AnswerCreditsError';
  }
}
