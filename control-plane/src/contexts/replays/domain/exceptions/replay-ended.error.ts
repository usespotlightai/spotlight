export class ReplayEndedError extends Error {
  readonly kind = 'conflict' as const;

  constructor(replayId: string) {
    super(`Replay ${replayId} has already ended or been stopped.`);
    this.name = 'ReplayEndedError';
  }
}
