export class RunGrantsEndedError extends Error {
  readonly violation = 'not-allowed' as const;

  constructor(runId: string) {
    super(`Run ${runId} has ended. It can receive no more secrets.`);
    this.name = 'RunGrantsEndedError';
  }
}
