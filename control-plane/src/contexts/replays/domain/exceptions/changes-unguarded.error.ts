export class ChangesUnguardedError extends Error {
  readonly violation = 'conflict' as const;

  constructor(stationKey: string) {
    super(
      `No replay set guards changes of station ${stationKey}. Please flag one of its replay sets as guarding changes.`,
    );
    this.name = 'ChangesUnguardedError';
  }
}
