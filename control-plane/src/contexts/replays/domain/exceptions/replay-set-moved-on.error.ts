export class ReplaySetMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(setId: string) {
    super(`The replay set ${setId} changed while this was being written`);
    this.name = 'ReplaySetMovedOnError';
  }
}
