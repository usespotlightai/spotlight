export class ReplayCheckRaceError extends Error {
  readonly violation = 'conflict' as const;

  constructor(stationKey: string) {
    super(
      `Another check of the same change of the station ${stationKey} started at the same moment; send the request again to be answered that check`,
    );
    this.name = 'ReplayCheckRaceError';
  }
}
