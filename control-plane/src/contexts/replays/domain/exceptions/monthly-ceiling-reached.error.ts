export class MonthlyCeilingReachedError extends Error {
  readonly kind = 'conflict' as const;

  constructor(lineId: string) {
    super(
      `Line ${lineId} has no room left in the monthly ceiling of its search policy.`,
    );
    this.name = 'MonthlyCeilingReachedError';
  }
}
