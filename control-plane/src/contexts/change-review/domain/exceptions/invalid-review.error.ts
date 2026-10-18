export class InvalidReviewError extends Error {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`A review ${reason}.`);
    this.name = 'InvalidReviewError';
  }
}
