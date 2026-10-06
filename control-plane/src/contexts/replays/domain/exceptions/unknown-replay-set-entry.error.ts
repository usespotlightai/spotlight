export class UnknownReplaySetEntryError extends Error {
  readonly violation = 'not-found' as const;

  constructor(runId: string) {
    super(`Run ${runId} is not in the replay set.`);
    this.name = 'UnknownReplaySetEntryError';
  }
}
