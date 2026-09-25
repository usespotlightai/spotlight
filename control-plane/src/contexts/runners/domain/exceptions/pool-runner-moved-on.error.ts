export class PoolRunnerMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(runnerId: string) {
    super(
      `This pool runner has been changed since it was read, and cannot be written over (${runnerId})`,
    );
    this.name = 'PoolRunnerMovedOnError';
  }
}
