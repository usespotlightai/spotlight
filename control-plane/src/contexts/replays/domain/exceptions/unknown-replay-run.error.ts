export class UnknownReplayRunError extends Error {
  readonly kind = 'not-found' as const;

  constructor(runId: string) {
    super(`Replay run ${runId} not found.`);
    this.name = 'UnknownReplayRunError';
  }
}
