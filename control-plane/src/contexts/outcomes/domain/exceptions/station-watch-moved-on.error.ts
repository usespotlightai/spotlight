export class StationWatchMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(stationId: string) {
    super(
      `This station's alerts changed since they were read, and cannot be written over (${stationId})`,
    );
    this.name = 'StationWatchMovedOnError';
  }
}
