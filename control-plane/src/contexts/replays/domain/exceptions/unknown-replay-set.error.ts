export class UnknownReplaySetError extends Error {
  readonly violation = 'not-found' as const;

  constructor(setId: string) {
    super(`Replay set ${setId} not found.`);
    this.name = 'UnknownReplaySetError';
  }
}
