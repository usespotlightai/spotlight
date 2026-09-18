export class UnknownReviewCommentError extends Error {
  readonly violation = 'not-found' as const;

  constructor() {
    super('There is no such review comment');
    this.name = 'UnknownReviewCommentError';
  }
}
