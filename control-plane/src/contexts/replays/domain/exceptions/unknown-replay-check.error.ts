export class UnknownReplayCheckError extends Error {
  readonly violation = 'not-found' as const;

  constructor(checkId: string) {
    super(`Replay check ${checkId} not found.`);
    this.name = 'UnknownReplayCheckError';
  }
}
