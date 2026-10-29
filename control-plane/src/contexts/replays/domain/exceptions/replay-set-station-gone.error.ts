export class ReplaySetStationGoneError extends Error {
  readonly kind = 'conflict' as const;

  constructor(setId: string) {
    super(
      `The station of replay set ${setId} is gone from its line. Spotlight replays nothing on the set.`,
    );
    this.name = 'ReplaySetStationGoneError';
  }
}
