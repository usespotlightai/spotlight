export class RunRecordMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(runId: string) {
    super(
      `This run's record changed since it was read, and cannot be written over (${runId})`,
    );
    this.name = 'RunRecordMovedOnError';
  }
}
