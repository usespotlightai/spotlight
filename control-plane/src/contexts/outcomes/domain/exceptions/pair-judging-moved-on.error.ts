export class PairJudgingMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(runId: string, against: string) {
    super(
      `This pair's judging changed since it was read, and cannot be written over (${runId} against ${against})`,
    );
    this.name = 'PairJudgingMovedOnError';
  }
}
