export class ChangeJudgingVersionConflictError extends Error {
  readonly violation = 'conflict' as const;

  constructor(runId: string) {
    super(
      `Judging of the change of run ${runId} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'ChangeJudgingVersionConflictError';
  }
}
