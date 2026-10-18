export class UnknownReviewCommentError extends Error {
  readonly kind = 'not-found' as const;

  constructor() {
    super('Review comment not found.');
    this.name = 'UnknownReviewCommentError';
  }
}
