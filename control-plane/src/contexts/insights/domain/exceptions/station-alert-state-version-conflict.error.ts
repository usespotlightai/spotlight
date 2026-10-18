export class StationAlertStateVersionConflictError extends Error {
  readonly kind = 'conflict' as const;

  constructor(stationId: string) {
    super(
      `Alerts of station ${stationId} changed since you loaded them. Please reload and try again.`,
    );
    this.name = 'StationAlertStateVersionConflictError';
  }
}
