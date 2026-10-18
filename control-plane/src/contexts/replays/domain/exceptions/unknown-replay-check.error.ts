export class UnknownReplayCheckError extends Error {
  readonly kind = 'not-found' as const;

  constructor(checkId: string) {
    super(`Replay check ${checkId} not found.`);
    this.name = 'UnknownReplayCheckError';
  }
}
