export class StrandedWorkError extends Error {
  readonly violation = 'conflict' as const;

  constructor(stationIds: readonly string[]) {
    super(
      `Line cannot drop stations that still have tasks. Please move those tasks first. Stations: ${stationIds.join(', ')}`,
    );
    this.name = 'StrandedWorkError';
  }
}
