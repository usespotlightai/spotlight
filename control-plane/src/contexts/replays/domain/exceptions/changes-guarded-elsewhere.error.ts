export class ChangesGuardedElsewhereError extends Error {
  readonly violation = 'conflict' as const;

  constructor(readonly stationId: string) {
    super(
      `Another replay set already guards changes of station ${stationId}. A station has only one such set.`,
    );
    this.name = 'ChangesGuardedElsewhereError';
  }
}
