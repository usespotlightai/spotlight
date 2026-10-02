export class ReplayMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(replayId: string) {
    super(`The replay ${replayId} changed while this was being written`);
    this.name = 'ReplayMovedOnError';
  }
}
