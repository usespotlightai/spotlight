export class ChangeJudgingMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(runId: string) {
    super(
      `This change's judging changed since it was read, and cannot be written over (${runId})`,
    );
    this.name = 'ChangeJudgingMovedOnError';
  }
}
