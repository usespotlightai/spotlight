export class NotYourReviewCommentError extends Error {
  readonly violation = 'not-allowed' as const;

  constructor() {
    super('Only the author can change a review comment.');
    this.name = 'NotYourReviewCommentError';
  }
}
