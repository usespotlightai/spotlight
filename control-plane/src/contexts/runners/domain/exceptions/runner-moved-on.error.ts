export class RunnerMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(id: string) {
    super(
      `This runner has changed since it was read, and cannot be written over (${id})`,
    );
    this.name = 'RunnerMovedOnError';
  }
}
