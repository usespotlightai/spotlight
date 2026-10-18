export class UnknownStationError extends Error {
  readonly kind = 'not-found' as const;

  constructor(stationId: string) {
    super(`Station ${stationId} not found.`);
    this.name = 'UnknownStationError';
  }
}
