export class RunGrantsMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(runId: string) {
    super(
      `Secret grants for run ${runId} changed since they were loaded. Please try again.`,
    );
    this.name = 'RunGrantsMovedOnError';
  }
}
