export class UnknownRunError extends Error {
  readonly violation = 'not-found' as const;

  constructor(runId: string) {
    super(`Run ${runId} not found.`);
    this.name = 'UnknownRunError';
  }
}
