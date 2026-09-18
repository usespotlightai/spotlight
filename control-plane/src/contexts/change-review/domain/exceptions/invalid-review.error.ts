export class InvalidReviewError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`A review ${reason}`);
    this.name = 'InvalidReviewError';
  }
}
