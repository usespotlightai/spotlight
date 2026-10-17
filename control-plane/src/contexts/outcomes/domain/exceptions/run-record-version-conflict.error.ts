export class RunRecordVersionConflictError extends Error {
  readonly violation = 'conflict' as const;

  constructor(runId: string) {
    super(
      `Record of run ${runId} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'RunRecordVersionConflictError';
  }
}
