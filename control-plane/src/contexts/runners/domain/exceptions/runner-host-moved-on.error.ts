export class RunnerHostMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(hostId: string) {
    super(
      `This host has changed since it was read, and cannot be written over (${hostId})`,
    );
    this.name = 'RunnerHostMovedOnError';
  }
}
