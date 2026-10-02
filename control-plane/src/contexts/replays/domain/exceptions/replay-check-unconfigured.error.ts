export class ReplayCheckUnconfiguredError extends Error {
  readonly violation = 'conflict' as const;

  constructor(lineKey: string) {
    super(
      `The line ${lineKey} has no replay_check, so no planned change of it is checked; give it a replay_check block with most_regressions, ceiling and currency`,
    );
    this.name = 'ReplayCheckUnconfiguredError';
  }
}
