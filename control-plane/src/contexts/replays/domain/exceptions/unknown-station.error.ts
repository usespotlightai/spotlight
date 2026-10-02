export class UnknownStationError extends Error {
  readonly violation = 'not-found' as const;

  constructor(stationId: string) {
    super(`There is no station ${stationId} for this caller`);
    this.name = 'UnknownStationError';
  }
}
