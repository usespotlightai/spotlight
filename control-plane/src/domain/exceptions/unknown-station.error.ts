export class UnknownStationError extends Error {
  readonly violation = 'not-found' as const;

  constructor(stationId: string) {
    super(`This assembly line has no station ${stationId}`);
    this.name = 'UnknownStationError';
  }
}
