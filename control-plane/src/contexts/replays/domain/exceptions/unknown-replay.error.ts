export class UnknownReplayError extends Error {
  readonly violation = 'not-found' as const;

  constructor(replayId: string) {
    super(`Replay ${replayId} not found.`);
    this.name = 'UnknownReplayError';
  }
}
