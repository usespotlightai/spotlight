export class ChangesGuardedElsewhereError extends Error {
  readonly violation = 'conflict' as const;

  constructor(readonly stationId: string) {
    super(
      `Another replay set guards the changes of the station ${stationId} already; a station has one such set`,
    );
    this.name = 'ChangesGuardedElsewhereError';
  }
}
