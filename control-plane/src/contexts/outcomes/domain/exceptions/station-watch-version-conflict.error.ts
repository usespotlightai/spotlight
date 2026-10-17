export class StationWatchVersionConflictError extends Error {
  readonly violation = 'conflict' as const;

  constructor(stationId: string) {
    super(
      `Alerts of station ${stationId} changed since you loaded them. Please reload and try again.`,
    );
    this.name = 'StationWatchVersionConflictError';
  }
}
