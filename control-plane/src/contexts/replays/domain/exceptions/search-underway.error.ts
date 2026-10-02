export class SearchUnderwayError extends Error {
  readonly violation = 'conflict' as const;

  constructor(stationId: string) {
    super(
      `The station ${stationId} is being searched already; stop that search first`,
    );
    this.name = 'SearchUnderwayError';
  }
}
