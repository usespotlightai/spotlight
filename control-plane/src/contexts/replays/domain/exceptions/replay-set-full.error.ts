export class ReplaySetFullError extends Error {
  readonly kind = 'conflict' as const;

  constructor(max: number) {
    super(`Replay set is full. Maximum runs: ${max}`);
    this.name = 'ReplaySetFullError';
  }
}
