export class InvalidReviewPolicyError extends Error {
  constructor(reason: string) {
    super(`Invalid review policy: ${reason}`);
    this.name = 'InvalidReviewPolicyError';
  }
}
