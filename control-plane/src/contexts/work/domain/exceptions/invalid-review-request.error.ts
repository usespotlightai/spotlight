export class InvalidReviewRequestError extends Error {
  constructor(reason: string) {
    super(`Invalid review request: ${reason}`);
    this.name = 'InvalidReviewRequestError';
  }
}
