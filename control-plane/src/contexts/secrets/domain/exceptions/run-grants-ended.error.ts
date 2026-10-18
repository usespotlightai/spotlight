export class RunGrantsEndedError extends Error {
  readonly kind = 'not-allowed' as const;

  constructor(runId: string) {
    super(`Run ${runId} has ended. It can receive no more secrets.`);
    this.name = 'RunGrantsEndedError';
  }
}
