export class ReplaySetFullError extends Error {
  readonly violation = 'conflict' as const;

  constructor(most: number) {
    super(`Replay set is full. Maximum runs: ${most}`);
    this.name = 'ReplaySetFullError';
  }
}
