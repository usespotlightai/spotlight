export class StationWithoutReplaySetError extends Error {
  readonly kind = 'not-found' as const;

  constructor(stationId: string) {
    super(`Station ${stationId} has no replay set yet.`);
    this.name = 'StationWithoutReplaySetError';
  }
}
