export class UnknownSearchError extends Error {
  readonly violation = 'not-found' as const;

  constructor(searchId: string) {
    super(`Search ${searchId} not found.`);
    this.name = 'UnknownSearchError';
  }
}
