export class RunAttemptOverError extends Error {
  readonly kind = 'conflict' as const;

  constructor(runId: string, attempt: number) {
    super(
      `Run ${runId} is no longer on attempt ${attempt} for this runner, so nothing more is done for that attempt`,
    );
    this.name = 'RunAttemptOverError';
  }
}
