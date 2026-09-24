export class RunnerRevisedError extends Error {
  readonly violation = 'conflict' as const;

  constructor(runnerId: string) {
    super(
      `This runner has been redefined since it was read, and cannot be written over (${runnerId})`,
    );
    this.name = 'RunnerRevisedError';
  }
}
