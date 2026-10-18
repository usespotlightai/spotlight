export class UnknownReplaySetEntryError extends Error {
  readonly kind = 'not-found' as const;

  constructor(runId: string) {
    super(`Run ${runId} is not in the replay set.`);
    this.name = 'UnknownReplaySetEntryError';
  }
}
