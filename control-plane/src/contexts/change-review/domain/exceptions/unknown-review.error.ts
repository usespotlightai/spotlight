export class UnknownReviewError extends Error {
  readonly violation = 'not-found' as const;

  constructor(what: string) {
    super(`There is no ${what} to review here`);
    this.name = 'UnknownReviewError';
  }
}
