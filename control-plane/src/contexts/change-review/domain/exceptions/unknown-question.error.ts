export class UnknownQuestionError extends Error {
  readonly kind = 'not-found' as const;

  constructor() {
    super('The change stack does not ask this question.');
    this.name = 'UnknownQuestionError';
  }
}
