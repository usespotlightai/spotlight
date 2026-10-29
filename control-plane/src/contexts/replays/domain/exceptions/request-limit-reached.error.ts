export class RequestLimitReachedError extends Error {
  readonly kind = 'conflict' as const;

  constructor(
    stationId: string,
    readonly limit: number,
  ) {
    super(
      `The station ${stationId} took ${limit} requested candidates today already`,
    );
    this.name = 'RequestLimitReachedError';
  }
}
