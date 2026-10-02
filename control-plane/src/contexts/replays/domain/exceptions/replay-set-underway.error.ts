export class ReplaySetUnderwayError extends Error {
  readonly violation = 'conflict' as const;

  constructor(setId: string) {
    super(
      `The replay set ${setId} is being replayed or searched; stop its replays and searches first`,
    );
    this.name = 'ReplaySetUnderwayError';
  }
}
