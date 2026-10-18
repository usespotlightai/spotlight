export class ChangesUngatedError extends Error {
  readonly violation = 'conflict' as const;

  constructor(stationKey: string) {
    super(
      `No replay set gates config changes of station ${stationKey}. Please turn on “Gates config changes” for one of its replay sets.`,
    );
    this.name = 'ChangesUngatedError';
  }
}
