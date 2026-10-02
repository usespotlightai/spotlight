export class ReplaySetUnderwayError extends Error {
  readonly violation = 'conflict' as const;

  constructor(setId: string) {
    super(`The replay set ${setId} is being replayed; stop its replays first`);
    this.name = 'ReplaySetUnderwayError';
  }
}
