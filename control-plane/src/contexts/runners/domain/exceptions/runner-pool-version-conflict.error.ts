export class RunnerPoolVersionConflictError extends Error {
  readonly kind = 'conflict' as const;

  constructor(poolId: string) {
    super(
      `Runner pool ${poolId} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'RunnerPoolVersionConflictError';
  }
}
