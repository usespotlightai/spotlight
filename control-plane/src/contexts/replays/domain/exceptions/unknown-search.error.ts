export class UnknownSearchError extends Error {
  readonly violation = 'not-found' as const;

  constructor(searchId: string) {
    super(`There is no search ${searchId} for this caller`);
    this.name = 'UnknownSearchError';
  }
}
