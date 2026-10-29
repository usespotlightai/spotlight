export class StationHasReplaySetError extends Error {
  readonly kind = 'conflict' as const;

  constructor(stationId: string) {
    super(`Station ${stationId} has a replay set already.`);
    this.name = 'StationHasReplaySetError';
  }
}
