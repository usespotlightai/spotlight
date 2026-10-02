export class SearchEndedError extends Error {
  readonly violation = 'conflict' as const;

  constructor(searchId: string) {
    super(`The search ${searchId} has ended`);
    this.name = 'SearchEndedError';
  }
}
