export class NotYourReviewCommentError extends Error {
  readonly violation = 'not-allowed' as const;

  constructor() {
    super('Only whoever wrote a review comment may change it');
    this.name = 'NotYourReviewCommentError';
  }
}
