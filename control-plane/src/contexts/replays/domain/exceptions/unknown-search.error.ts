export class UnknownSearchError extends Error {
  readonly kind = 'not-found' as const;

  constructor(searchId: string) {
    super(`Search ${searchId} not found.`);
    this.name = 'UnknownSearchError';
  }
}
