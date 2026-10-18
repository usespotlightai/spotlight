export class SearchReflectingError extends Error {
  readonly kind = 'conflict' as const;

  constructor() {
    super(
      'This search iteration looks into why the search stalled, so it proposes no candidates; record a cause for each failing task with spotlight cause',
    );
    this.name = 'SearchReflectingError';
  }
}
