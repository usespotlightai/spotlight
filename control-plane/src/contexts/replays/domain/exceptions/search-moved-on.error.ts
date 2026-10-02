export class SearchMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(searchId: string) {
    super(`The search ${searchId} changed while this was being written`);
    this.name = 'SearchMovedOnError';
  }
}
