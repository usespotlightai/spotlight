export class ReplayCheckRaceError extends Error {
  readonly violation = 'conflict' as const;

  constructor(stationKey: string) {
    super(
      `Another check of this change to station ${stationKey} started at the same moment. Please send the request again.`,
    );
    this.name = 'ReplayCheckRaceError';
  }
}
