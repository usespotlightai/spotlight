export class ReplaySetStationGoneError extends Error {
  readonly kind = 'conflict' as const;

  constructor(setId: string) {
    super(
      `The station of replay set ${setId} is gone from its line. You can only remove runs from the set.`,
    );
    this.name = 'ReplaySetStationGoneError';
  }
}
