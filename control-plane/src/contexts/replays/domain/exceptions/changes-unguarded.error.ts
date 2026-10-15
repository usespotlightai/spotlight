export class ChangesUnguardedError extends Error {
  readonly violation = 'conflict' as const;

  constructor(stationKey: string) {
    super(
      `No replay set guards config changes of station ${stationKey}. Please turn on “Guards config changes” for one of its replay sets.`,
    );
    this.name = 'ChangesUnguardedError';
  }
}
