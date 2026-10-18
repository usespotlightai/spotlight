export class InvalidReplayedPeriodError extends Error {
  readonly kind = 'invalid' as const;

  constructor() {
    super('Period must be 7d, 30d or 90d.');
    this.name = 'InvalidReplayedPeriodError';
  }
}
