export class ReplaySetStationGoneError extends Error {
  readonly violation = 'conflict' as const;

  constructor(setId: string) {
    super(
      `The station of replay set ${setId} is gone from its line. The set can only be renamed, trimmed or deleted.`,
    );
    this.name = 'ReplaySetStationGoneError';
  }
}
