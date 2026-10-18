export class ChangesGatedElsewhereError extends Error {
  readonly violation = 'conflict' as const;

  constructor(readonly stationId: string) {
    super(
      `Another replay set already gates config changes of station ${stationId}. Only one replay set of a station can gate config changes.`,
    );
    this.name = 'ChangesGatedElsewhereError';
  }
}
