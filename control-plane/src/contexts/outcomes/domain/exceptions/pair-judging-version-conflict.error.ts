export class PairJudgingVersionConflictError extends Error {
  readonly violation = 'conflict' as const;

  constructor(runId: string, against: string) {
    super(
      `Judging of run ${runId} against ${against} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'PairJudgingVersionConflictError';
  }
}
