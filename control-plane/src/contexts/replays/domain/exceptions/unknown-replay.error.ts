export class UnknownReplayError extends Error {
  readonly violation = 'not-found' as const;

  constructor(replayId: string) {
    super(`There is no replay ${replayId} for this caller`);
    this.name = 'UnknownReplayError';
  }
}
