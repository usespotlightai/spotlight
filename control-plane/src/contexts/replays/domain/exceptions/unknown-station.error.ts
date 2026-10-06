export class UnknownStationError extends Error {
  readonly violation = 'not-found' as const;

  constructor(stationId: string) {
    super(`Station ${stationId} not found.`);
    this.name = 'UnknownStationError';
  }
}
