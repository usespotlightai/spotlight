export class SearchNotReflectingError extends Error {
  readonly violation = 'conflict' as const;

  constructor() {
    super(
      'This search iteration proposes candidates; only an iteration that looks into why the search stalled records causes',
    );
    this.name = 'SearchNotReflectingError';
  }
}
