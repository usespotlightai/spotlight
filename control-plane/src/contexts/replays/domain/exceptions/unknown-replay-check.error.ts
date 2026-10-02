export class UnknownReplayCheckError extends Error {
  readonly violation = 'not-found' as const;

  constructor(checkId: string) {
    super(`There is no replay check ${checkId} for this caller`);
    this.name = 'UnknownReplayCheckError';
  }
}
