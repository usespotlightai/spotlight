export class SearchEndedError extends Error {
  readonly kind = 'conflict' as const;

  constructor(searchId: string) {
    super(`Search ${searchId} has ended.`);
    this.name = 'SearchEndedError';
  }
}
