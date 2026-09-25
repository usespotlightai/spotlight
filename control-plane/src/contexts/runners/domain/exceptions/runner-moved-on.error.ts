export class RunnerMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(runnerId: string) {
    super(
      `This runner has been changed since it was read, and cannot be written over (${runnerId})`,
    );
    this.name = 'RunnerMovedOnError';
  }
}
