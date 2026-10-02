export class UnknownReplayRunError extends Error {
  readonly violation = 'not-found' as const;

  constructor(runId: string) {
    super(`There is no replay run ${runId} for this caller`);
    this.name = 'UnknownReplayRunError';
  }
}
