export class ChangesGuardedElsewhereError extends Error {
  readonly violation = 'conflict' as const;

  constructor(readonly stationId: string) {
    super(
      `Another replay set already guards config changes of station ${stationId}. Only one replay set of a station can guard config changes.`,
    );
    this.name = 'ChangesGuardedElsewhereError';
  }
}
