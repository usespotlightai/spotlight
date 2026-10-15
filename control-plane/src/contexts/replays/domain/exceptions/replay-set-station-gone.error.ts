export class ReplaySetStationGoneError extends Error {
  readonly violation = 'conflict' as const;

  constructor(setId: string) {
    super(
      `The station of replay set ${setId} is gone from its line. You can only rename the set, remove runs from it or delete it.`,
    );
    this.name = 'ReplaySetStationGoneError';
  }
}
