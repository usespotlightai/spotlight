export class ReplayEndedError extends Error {
  readonly violation = 'conflict' as const;

  constructor(replayId: string) {
    super(`The replay ${replayId} has already ended or been stopped`);
    this.name = 'ReplayEndedError';
  }
}
