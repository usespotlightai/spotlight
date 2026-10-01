export class JudgingMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(runId: string) {
    super(
      `This run's judging changed since it was read, and cannot be written over (${runId})`,
    );
    this.name = 'JudgingMovedOnError';
  }
}
