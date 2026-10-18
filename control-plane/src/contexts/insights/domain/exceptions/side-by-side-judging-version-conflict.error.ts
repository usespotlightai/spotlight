export class SideBySideJudgingVersionConflictError extends Error {
  readonly violation = 'conflict' as const;

  constructor(runId: string, otherRunId: string) {
    super(
      `Side-by-side judging of run ${runId} and run ${otherRunId} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'SideBySideJudgingVersionConflictError';
  }
}
