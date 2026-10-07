export class SearchMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(searchId: string) {
    super(
      `Search ${searchId} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'SearchMovedOnError';
  }
}
