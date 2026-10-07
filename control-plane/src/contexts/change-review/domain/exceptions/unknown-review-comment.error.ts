export class UnknownReviewCommentError extends Error {
  readonly violation = 'not-found' as const;

  constructor() {
    super('Review comment not found.');
    this.name = 'UnknownReviewCommentError';
  }
}
