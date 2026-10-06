export class InvalidReviewPolicyError extends Error {
  constructor(reason: string) {
    super(`Review policy ${reason}.`);
    this.name = 'InvalidReviewPolicyError';
  }
}
