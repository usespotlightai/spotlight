export class UnknownReplayError extends Error {
  readonly kind = 'not-found' as const;

  constructor(replayId: string) {
    super(`Replay ${replayId} not found.`);
    this.name = 'UnknownReplayError';
  }
}
