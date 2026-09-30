export class UnknownRunError extends Error {
  readonly violation = 'not-found' as const;

  constructor(runId: string) {
    super(`There is no run ${runId} for this caller`);
    this.name = 'UnknownRunError';
  }
}
