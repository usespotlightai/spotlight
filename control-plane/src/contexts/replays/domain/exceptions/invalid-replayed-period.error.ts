export class InvalidReplayedPeriodError extends Error {
  readonly violation = 'invalid' as const;

  constructor() {
    super('Replayed candidates look back 7d, 30d or 90d');
    this.name = 'InvalidReplayedPeriodError';
  }
}
