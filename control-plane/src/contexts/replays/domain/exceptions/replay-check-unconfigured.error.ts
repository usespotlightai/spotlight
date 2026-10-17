export class ReplayCheckUnconfiguredError extends Error {
  readonly violation = 'conflict' as const;

  constructor(lineKey: string) {
    super(
      `Line ${lineKey} has no replay_check block. Please add one with max_regressions, ceiling and currency.`,
    );
    this.name = 'ReplayCheckUnconfiguredError';
  }
}
