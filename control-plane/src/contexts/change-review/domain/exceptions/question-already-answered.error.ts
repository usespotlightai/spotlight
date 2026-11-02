export class QuestionAlreadyAnsweredError extends Error {
  readonly kind = 'conflict' as const;

  constructor() {
    super('You already answered this question.');
    this.name = 'QuestionAlreadyAnsweredError';
  }
}
