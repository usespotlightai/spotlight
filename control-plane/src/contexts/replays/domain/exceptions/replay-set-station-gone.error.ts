export class ReplaySetStationGoneError extends Error {
  readonly violation = 'conflict' as const;

  constructor(setId: string) {
    super(
      `The station of replay set ${setId} is gone from its line, so it takes no more runs and starts no replays; it may still be renamed, have runs taken out, or be deleted`,
    );
    this.name = 'ReplaySetStationGoneError';
  }
}
