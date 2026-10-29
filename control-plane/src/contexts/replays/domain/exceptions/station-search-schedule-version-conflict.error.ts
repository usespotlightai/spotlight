export class StationSearchScheduleVersionConflictError extends Error {
  readonly kind = 'conflict' as const;

  constructor(stationId: string) {
    super(
      `The search schedule of station ${stationId} changed since it was loaded. Please try again.`,
    );
    this.name = 'StationSearchScheduleVersionConflictError';
  }
}
