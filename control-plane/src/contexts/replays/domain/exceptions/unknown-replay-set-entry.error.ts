export class UnknownReplaySetEntryError extends Error {
  readonly violation = 'not-found' as const;

  constructor(runId: string) {
    super(`The run ${runId} is not in the replay set`);
    this.name = 'UnknownReplaySetEntryError';
  }
}
