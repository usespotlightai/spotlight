export class RunnerPoolMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(poolId: string) {
    super(
      `This runner pool has been changed since it was read, and cannot be written over (${poolId})`,
    );
    this.name = 'RunnerPoolMovedOnError';
  }
}
