export class RunHoldOverError extends Error {
  readonly violation = 'not-allowed' as const;

  constructor(runId: string, attempt: number) {
    super(
      `Run ${runId} no longer holds attempt ${attempt}. That attempt can receive no more secrets.`,
    );
    this.name = 'RunHoldOverError';
  }
}
