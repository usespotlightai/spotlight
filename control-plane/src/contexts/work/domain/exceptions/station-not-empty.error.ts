export class StationNotEmptyError extends Error {
  readonly kind = 'conflict' as const;

  constructor(stationIds: readonly string[]) {
    super(
      `Line cannot drop stations that still have tasks. Please move those tasks first. Stations: ${stationIds.join(', ')}`,
    );
    this.name = 'StationNotEmptyError';
  }
}
