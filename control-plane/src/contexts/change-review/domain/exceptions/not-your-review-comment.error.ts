export class NotYourReviewCommentError extends Error {
  readonly kind = 'not-allowed' as const;

  constructor() {
    super('Only the author can change a review comment.');
    this.name = 'NotYourReviewCommentError';
  }
}
