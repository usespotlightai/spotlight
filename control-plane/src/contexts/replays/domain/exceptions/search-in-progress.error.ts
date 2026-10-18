export class SearchInProgressError extends Error {
  readonly kind = 'conflict' as const;

  constructor(stationId: string) {
    super(
      `Station ${stationId} is already being searched. Please stop that search first.`,
    );
    this.name = 'SearchInProgressError';
  }
}
