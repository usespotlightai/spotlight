export class InvalidInsightsPeriodError extends Error {
  readonly violation = 'invalid' as const;

  constructor() {
    super('Period must be 7d, 30d or 90d.');
    this.name = 'InvalidInsightsPeriodError';
  }
}
