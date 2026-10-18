export class SearchVersionConflictError extends Error {
  readonly kind = 'conflict' as const;

  constructor(searchId: string) {
    super(
      `Search ${searchId} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'SearchVersionConflictError';
  }
}
