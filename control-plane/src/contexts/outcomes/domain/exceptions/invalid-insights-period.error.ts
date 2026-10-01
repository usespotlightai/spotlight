export class InvalidInsightsPeriodError extends Error {
  readonly violation = 'invalid' as const;

  constructor() {
    super('Insights look back 7d, 30d or 90d');
    this.name = 'InvalidInsightsPeriodError';
  }
}
