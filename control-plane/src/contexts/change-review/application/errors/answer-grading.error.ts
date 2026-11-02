export class AnswerGradingError extends Error {
  readonly kind = 'upstream-error' as const;

  constructor() {
    super('Sorry, the answer could not be graded. Please try again later.');
    this.name = 'AnswerGradingError';
  }
}
