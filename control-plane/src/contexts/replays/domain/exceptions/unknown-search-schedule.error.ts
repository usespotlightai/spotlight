export class UnknownSearchScheduleError extends Error {
  readonly kind = 'not-found' as const;

  constructor(stationId: string) {
    super(`Station ${stationId} has no search schedule.`);
    this.name = 'UnknownSearchScheduleError';
  }
}
