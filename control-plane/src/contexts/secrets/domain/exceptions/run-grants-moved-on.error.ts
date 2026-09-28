export class RunGrantsMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(runId: string) {
    super(
      `The secrets granted to run ${runId} have changed since they were read, and cannot be written over`,
    );
    this.name = 'RunGrantsMovedOnError';
  }
}
