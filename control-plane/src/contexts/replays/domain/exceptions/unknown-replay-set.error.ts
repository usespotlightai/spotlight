export class UnknownReplaySetError extends Error {
  readonly violation = 'not-found' as const;

  constructor(setId: string) {
    super(`There is no replay set ${setId} for this caller`);
    this.name = 'UnknownReplaySetError';
  }
}
