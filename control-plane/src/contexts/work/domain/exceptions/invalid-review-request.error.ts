export class InvalidReviewRequestError extends Error {
  constructor(reason: string) {
    super(`Review request ${reason}.`);
    this.name = 'InvalidReviewRequestError';
  }
}
