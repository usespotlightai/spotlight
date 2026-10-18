export class InvalidReviewCommentError extends Error {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Review comment ${reason}.`);
    this.name = 'InvalidReviewCommentError';
  }
}
